---
title: Investigation Report
desc: An investigation report.
date: 2026-11-09T09:00+11:00
edit: 2026-11-09T09:00+11:00
tags: ["report"]
id: "2026-11-09-investigation-report"
---

# IBM Power S822 (8284-22A): Capacity on Demand investigation report
### Reverse engineered by Deepseek V4.1 Flash 1017.

| Item| Desc |
|---|---|
| **Machine** | IBM Power System S822, `8284-22A` |
| **Firmware** | FW860.20  |
| **Cores** | 20 installed · **10 licensed** · 10 inactive |
| **Report written**| 2026-11-06 |

Every claim below is tagged:

| Tag | Meaning |
|---|---|
| **[M]** | Measured: read live from this machine, or decompiled from its own firmware |
| **[X]** | External evidence: IBM documentation, patents, shipped source |
| **[I]** | Inference: consistent with the evidence, not proven |

## Contents

**Part 1: the CoD mechanism and the walls**

- [1. Executive summary](#1-executive-summary)
- [2. The machine is three computers](#2-the-machine-is-three-computers)
- [3. Getting in: the access chain and its traps](#3-getting-in-the-access-chain-and-its-traps)
- [4. What is on the service processor](#4-what-is-on-the-service-processor)
- [5. How Capacity on Demand works](#5-how-capacity-on-demand-works)
- [6. The activation oracle](#6-the-activation-oracle)
- [7. Every dump fails to capture the hypervisor](#7-every-dump-fails-to-capture-the-hypervisor)
- [8. Door B: writing the VPD](#8-door-b-writing-the-vpd)
- [9. FORB is CORBA](#9-forb-is-corba)
- [10. The anchor VPD, read live from the service processor](#10-the-anchor-vpd-read-live-from-the-service-processor)
- [11. Why the licence cannot be forged](#11-why-the-licence-cannot-be-forged)
- [12. The walls](#12-the-walls)
- [13. Why the write was not fired](#13-why-the-write-was-not-fired)

**Part 2: closing the remaining unknowns**

- [14. VPD storage encoding: `libvpdecc.so`](#14-vpd-storage-encoding-libvpdeccso)
- [15. The smart-chip interface and the device model](#15-the-smart-chip-interface-and-the-device-model)
- [16. Residual unknown ledger, final state](#16-residual-unknown-ledger-final-state)
- [17. Anchor validation: closed, and not a licence check](#17-anchor-validation-closed-and-not-a-licence-check)
- [18. The `svpdserver` module registry: 126 actions](#18-the-svpdserver-module-registry-126-actions)
- [19. The keyword update pipeline and the vrid encoding](#19-the-keyword-update-pipeline-and-the-vrid-encoding)
- [20. ANCHOR and SYSTEM field semantics](#20-anchor-and-system-field-semantics)
- [21. Register-write feasibility: the SCOM path](#21-register-write-feasibility-the-scom-path)
- [22. SCOM ioctl ABI: field semantics](#22-scom-ioctl-abi-field-semantics)
- [23. SCOM ABI validated, with a correction](#23-scom-abi-validated-with-a-correction)
- [24. Addressed SCOM read: the ABI confirmed](#24-addressed-scom-read-the-abi-confirmed)
- [25. Checkstop trigger: no deterministic path](#25-checkstop-trigger-no-deterministic-path)

---
---

# Part 1: the CoD mechanism and the walls

## 1. Executive summary

The 10 locked cores are held by a licensed-entitlement count stored on the anchor card, in the `ANCHOR` VPD record, keyword `HE` = `0010`. Everything else in this report describes how that number is read, checked, and protected.

The investigation produced the following:

* Root shell on the service processor, reproducibly (`celogin1` plus a computed dynamic password), still working when the investigation ended.
* The complete CoD mechanism reversed to instruction level, from web page through mailbox and hypervisor to the anchor card, including the exact argument marshalling of the activation handler and the fact that the service processor performs no validation of its own.
* A live activation oracle: the machine's real accept/reject behaviour measured for twelve different key lengths.
* Five independent dump attempts, all confirming that the hypervisor's private memory is never captured by any dump this machine can produce.
* The finding that FORB, IBM's "proprietary" FSP ORB, is standard CORBA GIOP 1.2 over a unix socket. A real transaction was captured through a man-in-the-middle relay.
* A working hand-written GIOP client in Python 2.6 (no omniORB, no compiler) that reads VPD records out of the running service.
* The first read of the anchor VPD through the service processor's own service interface rather than carved from a memory dump, confirming `HE=0010`, the `B9` integrity tags, and the whole keyword set.

One thing was not achieved. The licensed count cannot be changed without either an IBM-issued activation code or a write to the anchor card's VPD. The write API is reachable, but writing it is licence circumvention rather than research, the call's arguments are only partly known, and a malformed write to that record can leave the machine unable to IPL.

---

## 2. The machine is three computers

Every confusion in this investigation traces back to one of these three boxes:

```
┌────────────────────────────────────────────────────────────────────┐
│ SERVICE PROCESSOR (FSP)  — small PPC476 Linux system-on-module     │
│  kernel 2.6.32-279.14.1.94.fsp_fld8_6.ppcnf-fsp2, busybox 1.18.3    │
│  Runs always (even when the machine is off).                       │
│  Hosts: ASMI web UI (lighttpd, port 443), /opt/fips/bin (158 tools) │
│  Owns: SPCN/I²C bus to the anchor card, dumps, call-home, VPD       │
└───────────────────────────────┬────────────────────────────────────┘
                                │ hardware mailbox + TCE DMA window
                                │ (class 0xE5 = CUOD_EVENT)
┌───────────────────────────────▼────────────────────────────────────┐
│ HOSTBOOT — initialises processors, memory, fabric                  │
└───────────────────────────────┬────────────────────────────────────┘
                                │ loads LID 80a0:0701
┌───────────────────────────────▼────────────────────────────────────┐
│ pHyp — the PowerVM hypervisor. Runs ON the POWER8 cores.           │
│  Creates LPARs, owns dispatch/memory/interrupts, and               │
│  **enforces the licensed core count at every IPL**.                │
│  Contains the CoD manager (module ApODA, console verb `cfcuod`)    │
└───────────────────────────────┬────────────────────────────────────┘
                                │ SPCN smart-chip commands
┌───────────────────────────────▼────────────────────────────────────┐
│ ANCHOR CARD — VPD storage + SPCN smart chip (secure element)        │
│  ANCHOR record: CC/SN/HE/B9 …   HE = "0010" = licensed processors   │
│  B9: CS+UID8, SP+8, M1+8, M2+8, M3+8, M4+8  (four chip-made tags)  │
└────────────────────────────────────────────────────────────────────┘
```

One consequence decides everything else. The pHyp hypervisor has no bus access. It cannot read the anchor card directly; it asks the service processor over the mailbox, and the service processor performs the actual chip transaction. The SP is therefore the only route to the card, and pHyp is the only thing that decides how many cores exist.

---

## 3. Getting in: the access chain and its traps

### 3.1 The chain

```
admin / <redacted>                           ← customer administrator
  └─ Login Profile → User Access Policy (form 99)
       └─ disable celogin1, then re-enable it → ASMI demands a new password
            └─ celogin1 / Cel0g1n#Arch26     ← authorised service provider
                 └─ Service Processor Command Line (form 16)
                      └─ dynamic password  D5421417
                           └─ ROOT SHELL ON THE FSP
```

The dynamic password is computable, not secret **[M]**:

```c
f(x, sel) = 4-byte substitution, table T0 (sel=0) or T1 (sel=1),
            256-byte permutations
g(x)      = base-227 then base-179 digit folding
IsValidCePW(pw, s1, s2, y, m, d):
    a2 = strtoul_hex(sanitise(s1))     # Raw_MachineTypeModel = "8284-22A"
    a3 = strtoul_hex(sanitise(s2))     # Raw_MachineSerialNumber = "68F8EDW"
    sum  = y*983 + m*41 + d            # FSP clock → 1970-01-01
    code = f(g(f(a3,0)),1) ^ g(sum) ^ g(a2)
    return sprintf("%08lX", code) == pw
```

The FSP clock is unset at 1970-01-01, which pins the result:

```
8284-22A / 68F8EDW / 1970-1-1  →  D5421417
```

### 3.2 Traps hit along the way, and the fixes

These cost real time and are worth keeping.

| Trap | Symptom | Fix |
|---|---|---|
| Session model | No cookies at all; sessions keyed by source IP; hard cap of 3 concurrent; no logout endpoint; `Too many users` when exceeded | Log in once, reuse the jar, never retry in a loop |
| Login response lies | A failed login returns the same frameset as success | Confirm by fetching `?form=2` and looking for `Expand all menus` |
| Double quotes are stripped | The CGI deletes `"` from `cmd` before the shell sees it, so `grep -E "a|b"` silently becomes a shell pipe | Use single quotes only, everywhere |
| 200-character command limit | Longer commands are silently truncated | Chunk, or upload files |
| `CSRF_TOKEN` rotates per page load | Every POST needs a fresh one | Re-fetch the page immediately before posting |
| HTML tag-stripping corrupts binaries | Uuencoded lines start with `M<`, which looks like a tag and gets eaten | Parse the raw response body |
| `busybox` symlinks missing | `nc`, `base64`, `od`, `md5sum`, `chpasswd` are not on `PATH` | Call `busybox <applet>`; `hexdump` and `uuencode` work, `od`/`base64` do not |
| No `ctypes`, no omniORBpy, no sqlite3 in the FSP's Python 2.6 | Cannot FFI into system libraries | Speak the wire protocols directly |
| Sessions expire mid-work | `no CSRF token - session lost` | Re-login helper, and re-open form 16 with the dynamic password |


## 4. What is on the service processor

The FSP holds 158 binaries in `/opt/fips/bin`, 140 shared libraries, 26 component directories and 101 running processes, on busybox 1.18.3 with Python 2.6 providing `socket`, `struct` and `hashlib` **[M]**.

Tools that matter for CoD work:

| Tool | What it is |
|---|---|
| `asm` | The ASMI web application (696,628 bytes); renders every form |
| `svpdserver` | VPD collection plus read/write service (CORBA, 374 KB) |
| `svpdcmd` | Thin client for the read verbs only (12 sub-commands, all read-only) |
| `scod_determine_val` | Not capacity; decompiled, it reads `smgr/CecIplType` / `smgr/FspIplType` and sets power-loss flags |
| `mboxmainprocess` | The mailbox daemon that talks to pHyp |
| `libmboxuser.so` | `mboxCuodCommands(mode, buf, len, &status, dma, &len)` |
| `libfdal.so` / `ecmd_ppc` | JTAG/SCOM stack: `getscom`, `putscom`, `getcfam`, no `getmem` |
| `netsPhypDebugger` | IBM's host-memory debugger bridge (needs a client) |
| `libmnfg.so` | Manufacturing policy (`mnfg/PolicyFlags`, 16 bytes) |

Device nodes present: `/dev/iic`, `/dev/fsi`, `/dev/jtag`, `/dev/scom`, `/dev/mbx`, `/dev/mem`, `/dev/mtd*`.

Everything lives on a 740 MB ext3 root with 367 MB free; `/opt/p1` is jffs2 flash.

---

## 5. How Capacity on Demand works

### 5.1 What the licence is

The entire entitlement is one 4-character ASCII field in the anchor card's `ANCHOR` VPD record **[M]**:

```
HE 04 "0010"        ← ASCII decimal: ten licensed processors
```

The field is human-readable decimal text, not binary.

ASMI form 22 reports the same number as `Permanent processors: 0010`, with `Installed processors: 0020` and `Inactive processors: 0010`. The hypervisor presents `HE` cores to the partition at IPL; with 8 SMT threads per core that is 10 × 8 = 80 logical CPUs visible to an OS.

### 5.2 The identity record

The activation code is bound to this machine by a fixed-width ASCII record, recovered from trace buffers in the hypervisor dump **[M]**:

```
TTTT SSSSSSSS PPPP ssssssssss uuuuuuuuuuuuuuuu AAAA cccc NNNN KK
8284 68-F8EDW 52F5 08-4742005 709218520551784F 54BC 0010 0041 D0
│    │        │    │          │                │    │    │    └── entry check
│    │        │    │          │                │    │    └─────── sequence
│    │        │    │          │                │    └──────────── activated
│    │        │    │          │                └───────────────── resource id
│    │        │    │          └────────────────────────────────── anchor UID
│    │        │    └───────────────────────────────────────────── anchor serial
│    │        └────────────────────────────────────────────────── anchor CCIN
│    └─────────────────────────────────────────────────────────── system serial
└──────────────────────────────────────────────────────────────── type
```

Three live records **[M]**:

| Resource | Id | Activated | Seq | Check |
|---|---|---|---|---|
| Processor | `54BC` | `0010` | `0041` | `D0` |
| Memory | `8212` | `0000` | `0040` | `58` |
| VET (virtualisation) | `CA1F` | `0000` | `0040` | `A9` |

Two template widths exist: 56-character (`…AAAA cccc NNNN KK`) and 60-character (`…AAAA 0000 NNNN #### kk`), plus 74/76-character delimiter variants used by test code.

### 5.3 The four mailbox modes

Decompiled from the installed `asm` (sha256 `9ba399f5…`, which differs from the copy inside the firmware package, `28e3674e…`, used by the earlier analysis) **[M]**:

| Mode | Sub-command | ASMI page | Function |
|---|---|---|---|
| 1 | `MBOX_SUB_CUOD_ORDER_DATA_X01` | 22/23/24 | Read a 42-byte info record `4/8/4/10/16` |
| 2 | `MBOX_SUB_CUOD_ORDER_DATA_X02` | 19 | Submit the activation key, ≤52 chars |
| 3 | `MBOX_SUB_CUOD_ORDER_DATA_X03` | 20 | Recovery / commit |
| 4 | `MBOX_SUB_CUOD_COMMAND_X04` | 21 | Run a `cfcuod …` diagnostic |

Handler symbols present: `cuod_initialize`, `cuod_process_html_key`, `cuod_process_html_recovery`, `cuod_process_html_command`, `cuod_show_html_info`, `cuod_show_html_proc_info`, `cuod_show_html_mem_info`, `cuod_show_html_vet_info`, `cuod_show_html_cap_bits`.

### 5.4 The activation handler, decompiled

This is the single most important piece of code in the investigation:

```c
void cuod_process_html_key(void)
{
    char buf[0x35];
    memset(buf, 0, 0x35);                    /* 53-byte buffer          */
    p = get_form_field("cuod");
    if (p && *p) {
        if (FUN_100122d0(p, ctx + 0x30)) {   /* the ONLY FSP-side test  */
            strncpy(buf, p, 0x34);           /* hard 52-character limit */
            st = mboxCuodCommands(2, buf, strlen(buf), &status, 0, &out);
            render(page_0x212);              /* status printed as "(n)" */
            return;
        }
    }
    html_out(msg 0x1e);
}
```

And the test itself, decompiled verbatim:

```c
bool FUN_100122d0(char *s, char *set)
{
    return strspn(s, set) == strlen(s);   /* character-set test only */
}
```

The service processor does not judge the code. It checks that every character is in the allowed alphabet and forwards the string. There is no length check, no structure check, no arithmetic, no attempt counter, no key comparison. The decision is made above it.

### 5.5 What happens on a successful activation

```
code → mailbox 0xE5 mode 2 → pHyp CoD manager
     → pHyp builds the identity record, offers the code to the anchor card
     → the card's smart chip validates it against a key it holds internally
     → on success pHyp writes HE (0010 → 0014), bumps the sequence number,
       recomputes the check field, and marks the new capacity
     → the extra cores are enabled at the next IPL
```

---

## 6. The activation oracle

With the machine in firmware standby, keys were submitted on form 19 and committed on form 20 **[M]**:

| Key | Length | Response |
|---|---|---|
| `A` × 1, 8, 16, 20, 21, 24, 25, 28, 30, 32 | ≤ 32 | `Invalid activation key(128)` |
| `A` × 34, 40, 50, 51, 52 | ≥ 34 | `Could not process the request.(254)` |

* `128` = status `0x80` = documented `A7004740`, "incorrect activation code".
* `254` = status `0xFE`, not in the documented status table.

The behaviour changes between 32 and 34 characters, which is the only structural hint the machine gives about real code length. The `CoD Recovery` page (form 20) always returns `Operation completed successfully`, and a rejected key never changes `Activated Resources`, so commits are safe to attempt.

Because the FSP performs only the alphabet test, this split is decided entirely in pHyp, not in the web layer. There is no partial check on the SP to satisfy incrementally and nothing on the SP to patch.

---

## 7. Every dump fails to capture the hypervisor

Five separate attempts were made, the last with the most permissive settings the machine offers **[M]**:

```
form 28 → Dump policy: Enabled
          Hardware content: Maximum
          Server firmware content: Maximum
```

Progress: `SYSTEM_DUMP_REQ → HEADER_COLLECTION → SYS_COLLECT_START/END → MEM_PRESERVE_IPL_REQ → MS_COLLECT_START/DONE`

Result:

| Section | Size |
|---|---|
| `HwUData` | 7,125,648 B |
| `SysData` (the "HYPERVISOR DATA" section) | 2,088 B |

The 2,088 bytes are not memory at all. They are a settings snapshot:

```
rbot/RebootCount   fstp/DriverName = fips861/b0312a_1712.861
dump/DumpPolicy    dump/OverrideContent   menu/PhypDumpContent
smgr/CecIplType    iplp/SysOpMode         menu/HypMode
bdmp/FspADumpId    bdmp/FspBDumpId
```

The hypervisor's private region (`0xFFFFFFFFFE000000`–`0xFFFFFFFFFEB10000`, about 11 MB), which holds the CoD validator and the relocated CoD data plane, is absent from every dump this machine can produce. That is now measured five times, once with maximum firmware content and a memory-preserving IPL explicitly requested.

---

## 8. Door B: writing the VPD

### 8.1 No user-facing write path exists

| Attempted route | Result |
|---|---|
| ASMI Program Vital Product Data (form 93) as `celogin1` | `You are not authorized to access this page.` in running state and in standby |
| Same as `mfg` (password temporarily set from root, then reverted) | Page is authorised but renders nothing at all |
| `mfg` + `mnfg/PolicyFlags` bit 0 set via `utilreg -w` | Still renders nothing; flag reverted to zeros |
| System Keywords / System Brand (forms 63–66) as `mfg` | Redirect to `/` (not authorised) |
| Fwsm SQLite VPD database (`/opt/fips/components/fwsm/tuleta-2u/*.p3`) | Anchor record absent (0 hits for serial, UID, CCIN) |
| `svpd_converged.dat` | A blank template (`DR` empty, `CC=444A`, `HE=0001`) |
| `svpdcmd` | 12 sub-commands, all collection/verification, no writes |
| Scanning `/opt/fips` for `updateKeywordField` | Only `libsvpdidl.so` (the IDL) and `libsvpdclient.so` (the stub); no tool on the box calls it |

The reason form 93 is empty was found by decompiling `asm`: it never references `VpdService` at all. The Program VPD page is a stub, not a permissions problem.

### 8.2 But the write API does exist

The `svpdserver` implements a second interface, `IDL:SVPD/VpdService:1.0`, which no CLI exposes **[M]**:

| Operation | Purpose |
|---|---|
| `updateKeywordField(vrid, key, field, Stream, b,b,b,b,b, out)` | Change one keyword's value |
| `setFspGDKeyword(vrid, Stream)` | Set a global-data keyword |
| `updateFlexVpd(vrid, ulong, Stream)` | Update a flexible record |
| `writeModuleVpdImage(vrid, Stream)` | Replace a module VPD image |
| `resetAndValidateAnchor()` | Force anchor revalidation |
| `getASCIIKeywordVpd`, `getVpdRecord`, `readFspKeyword`, `readAnchorVsrcBlock`, `regKw` | Reads |

The stub's signature was recovered from the mangled symbol and confirmed against its register usage:

```c
void updateKeywordField(unsigned long vrid,        // r4
                        const unsigned char *key,  // r5
                        const char *field,         // r6
                        const SVPD::Stream &value, // r7
                        bool, bool, bool,          // r8, r9, r10
                        bool, bool,                // stack
                        unsigned long &out);       // stack
```

The vrid for the anchor record is `0x500`. The stream is a `sequence<octet>`, so a value is just a length plus bytes: `"0014"` is four bytes.

### 8.3 What the VPD storage layer actually is

Following the write API into the libraries that back it turned up the reason hand-editing VPD is harder than "change four ASCII characters".

The `svpdserver` links `libivpd.so`, `libsced.so` and `libvpdecc.so`. Their exported functions describe three distinct layers **[M]**:

| Layer | API | What it means |
|---|---|---|
| EEPROM encoding (`libvpdecc.so`, in `/usr/lib`, 5,780 bytes) | `vpdecc_check_data`, `vpdecc_create_ecc`, `seepromScramble`, `seepromUnscramble`, `seepromEccCheck`, `seepromGetEcc`, `seepromGenCsDecode`, `seepromGenerateCheckSyndromDecode` | VPD is stored scrambled with ECC check syndromes, not as plain bytes |
| Internal VPD model (`libivpd.so`) | `IVPD_seepromRead`, `IVPD_seepromWrite`, `IVPD_setAttribute`, `IVPD_dpRead`, `IVPD_dpConfig` | Typed attribute access over the raw store |
| Anchor card smart chip (`libsced.so`) | `SCED_read_block_data`, `SCED_write_data_to_block`, `SCED_get_block_info`, `SCED_presence_detect`, `SCED_smartchip_reset` | The secure element, addressed by block name |

Two consequences that matter:

1. A raw byte write would not work even in principle. Writing `0014` over `0010` in the EEPROM image without regenerating the scramble and the check syndromes produces a record that fails its own storage-level integrity, before any licence logic runs.
2. The chip is addressed by name, not by offset. `SCED_*` takes a block-name string, so the card's contents are a set of named blocks rather than a flat VPD image.

The `svpdserver` additionally contains its own anchor module with named entry points, which is where the anchor-specific policy lives **[M]**:

```
svpd_anchor_reset_validate              svpd_anchor_read_block
svpd_anchor_reset_compare_cache         svpd_anchor_read_vsrc
svpd_anchor_check_gard_read_block       svpd_anchor_read_vsys_updt_nvram_entries
```

And a generic module registry with write entries:

```
svpd_module_hw_write    svpd_module_generic_write    svpd_writeAllModuleData
svpd_module_get_vpd_record                           svpd_getAllModuleData
```

So a VPD update is a three-stage operation: decode and validate the EEPROM encoding, update the typed attribute, re-encode and write back through the smart chip. The `updateKeywordField` call is the front door to all three **[I]**. That is consistent with the write simply not being safe to invoke without knowing the argument semantics exactly.

This also resolves the earlier open question. The `VpdService` object is instantiated and answers `getASCIIKeywordVpd` on the live machine, and a C++ class with unimplemented pure virtuals cannot be constructed. All of its declared operations, including `updateKeywordField`, are therefore implemented in the running server. The earlier "no binary calls it" observation was a red herring: the op names exist only as literals in the dispatching library (`libsvpdidl.so`), and the `svpdserver` binary is stripped, so its own method names appear nowhere. The path is real; it was simply never used.

---

## 9. FORB is CORBA

This was the pivotal discovery of the investigation, and it came from retesting a wrong assumption.

### 9.1 The false start

The `svpdserver` listens on unix sockets `/tmp/forb.socket.fsp.a.<service>`, and `libforb.so` contains no `GIOP` string. That initially read as "IBM uses a private protocol", and a standard CORBA client was assumed impossible.

### 9.2 The correction

The `libforb.so` library links `libomniORB4.so.1` and `libomnithread.so.3`. The `GIOP` strings live in libomniORB, not in libforb. FORB is ordinary omniORB, with the unix socket as the transport.

### 9.3 Capturing a real transaction

The `svpdserver` socket was moved aside and a Python relay bound in its place; a normal client (`svpdSystemVpd`) then ran and both directions were recorded **[M]**:

```
[C] GIOP 1.2 Request  op=collectSystemVpd
    key=\xff"Fips ST POA"\0"CollectionService"
[S] GIOP 1.2 Reply
[C] op=getMaxNumberOfRids  key=\xff"Fips ST POA"\0"QueryService"
[C] op=_non_existent      key=\xff"Fips MT POA"\0"ServerReady"
[C] op=getRids            key=\xff"Fips ST POA"\0"QueryService"
```

The socket was then restored and verified healthy (`svpdSystemVpd` rc=0, ASMI VPD page still lists the anchor card), and the relay removed.

### 9.4 The framing, learned the hard way

```
GIOP 1.2 Request
  "GIOP" 01 02 | flags | msgtype=0 | size(4)
  rid(4) | respflags(1)=03 | 3 pad | TargetAddress disc(2)=0 | pad to 4
  keylen(4) | key | oplen(4) | operation | align4 | context count(4)=0 | args…
key = \xff + POA path + \0 + ObjectId      e.g. \xffFips ST POA\0VpdService
```

Two lessons that cost hours:

1. Padding bytes are garbage, not zero. The omniORB library leaves uninitialised memory in CDR padding; one captured request had `6f 6e` (the ASCII "on") sitting in padding. Offsets must be computed from alignment rules, because matching byte patterns lies.
2. `CloseConnection` (msgtype 6) means your request reached a real object. An unknown object returns a proper `OBJECT_NOT_EXIST` exception instead. That gives a reliable existence oracle, and it is how `VpdService` was confirmed present.

---

## 10. The anchor VPD, read live from the service processor

Calling `getASCIIKeywordVpd(vrid=0x500, bool)` returns the whole record **[M]**. This is the first time the anchor record has been read through the SP's own service interface rather than recovered from a memory dump:

```
RT 04 "VINI"
DR 16 "ANCHOR          "
CE 01 31                     VZ 02 "01"
FN 07 "00E2150"              PN 07 "00E2148"
SN 12 "YL1084742005"         CC 04 "52F5"
PR 08 81 00 30 00 00 00 00 00
HE 04 "0010"                          ← licensed processor count
CT 04 40 B4 00 00            HW 02 00 01
B3 06 00 00 00 00 00 01      B4 01 00
B7 12 00×12
B9 60  "CS" 70 92 18 52 05 51 78 4F      ← anchor UID
       "SP" C7 E1 4A 9D 5E EA 01 AC
       "M1" 9A D2 C8 B5 B6 CC B6 D7
       "M2" 7C 04 7A 45 7C 9F 05 34
       "M3" BD A9 E7 46 20 52 23 61
       "M4" A0 A6 F0 9E F3 A1 3A 99
PF 03 00 00 00
```

Every value previously inferred from dumps is confirmed: `HE=0010`, the `B9` decomposition `CS`+UID, `SP`, and four 8-byte tags, and the exact keyword ordering, including the uninitialised `00` in `PR` that was 0x81 in the dump copy.

### 10.1 The rest of the VPD store

Other records read the same way **[M]**:

| Vrid | Record | Notable contents |
|---|---|---|
| `0x0500` | `ANCHOR` | `CC=52F5`, `SN=YL1084742005`, `HE=0010`, `B9` tags |
| `0x1c00` | `SYSTEM` (`RT VSYS`) | `BR=S0`, `SE=68F8EDW`, `TM=8284-22A`, `SU=00 04 ac 1c b0 af`, `RG=f0 c0 00 00`, `RB=3`, `WN=C0507609E20E`, `FV=SV860_056` |
| `0x1000`,`0x1001` | `10-WAY PROC CUOD` | `CC=54E8`, `SN=YA1934132683`, `HE=0001`, `PR=35 00 50 01 22 00 80 01` |
| `0x0200`,`0x0800`,`0x1e00` | `I/O BACKPLANE` | `CC=2CD6`, `SN=YL10UF72N00W`, `HE=0002` |

Two observations worth flagging:

* `FV=SV860_056` in system VPD does not match the running `SV860_082`. That field is stale and should not be trusted as a firmware-level indicator.
* The processor records say `HE=0001` each. Whatever that keyword means on a processor FRU, it is not the licensed core count; the anchor record's `HE=0010` is.

---

## 11. Why the licence cannot be forged

### 11.1 What the check is not

The `entry_check` field (`D0`, `58`, `A9`) looks like a checksum, and everyone assumed it was one. It is not **[M]**. Over every contiguous prefix of each record, none of these fit:

* sum-8, XOR-8, sum-16 (BE/LE, folded, low byte, high byte)
* nibble sums of the hex digits, single positional weighting
* all 256 CRC-8 polynomials × all 256 initial values, MSB-first and reflected
* all 65,536 CRC-16 polynomials, init 0 and 0xFFFF
* 21 "decoded value vector" layouts × {sum8, xor8, sum16}

And the check is unchanged when the record is rendered with the serial padded from 8 to 10 characters, so it is a function of the field values, not the characters.

### 11.2 Because firmware does not compute it

There is no checksum routine anywhere in the firmware that was analysed **[M]**: 12,032 function prologues scanned for a leaf byte-loop (3 candidates, none looping); `IoHriAnchorCard` (2,282 instructions) and `HvKeywordVpdPhyp` (1,336) contain zero `lbz` loops; `ApODA` contains no character comparisons at all; whole-image searches for `entry_check`/`entryCheck`/`checkByte` return zero.

### 11.3 Where it comes from instead

The 8-byte billing `signature` `287C1456AAA15261` occurs exactly twice in 655 MB of memory, both times inside `TCE-SPCN SMART CHIP (READ)` traffic, the anchor card's secure element **[M]**. The `B9` keyword holds four 8-byte values, one per CoD record type, replicated identically in all four copies of the record.

IBM's own patents describe the mechanism **[X]**: validation uses *"enablement data stored on a smart chip onboard the systems"*; the chip holds *"a unique key"*; it is *"tamper-resistant (i.e., not accessible by the user)"*; and *"Disablement could be accomplished by replacing the smart chip that stores the enablement data."*

Which is why IBM's documented remedy for a rejected activation code is *"If the activation code is valid, replace the VPD card."* The card is the trust anchor.

---

## 12. The walls

| # | Route | Status |
|---|---|---|
| 1 | Forge an activation code | Blocked: key inside the smart chip, never leaves it |
| 2 | Brute force the code | Blocked: 64⁵² ≈ 8.5×10⁹³, and only ~5 attempts before `A7004741` lockout |
| 3 | Timing side-channel | Blocked: secure element does bulk decrypt/compare; measurement point is behind SPCN framing and milliseconds of transport jitter |
| 4 | Read the validator from memory | Blocked: 5 dumps, hypervisor region never captured |
| 5 | Patch the firmware | Blocked: signed images; and this would be licence circumvention |
| 6 | Write the VPD via the ASMI | Blocked: Program VPD is a stub; `asm` never references `VpdService` |
| 7 | Write the VPD via the fwsm database | Blocked: the anchor record is not in it |
| 8 | Write the VPD via the service API | Reachable: GIOP client works, `VpdService` present, `updateKeywordField` mapped.|
| 9 | HMC `chcod` | Blocked: the HMC manages zero systems; the box is in MDC |
| 10 | Free Trial CoD | Spent: 10 procs / 30 days used in Aug–Sep 2023, expired and reclaimed |
| 11 | JTAG/COP on `J1_DCM1_JTAG` | Untrodden: 22-pin header exists on the processor module; no published pinout, possibly fused, needs a COP probe, and mis-identifying VREF destroys the CPU |

---

## 13. Why the write was not fired

The call would be:

```
VpdService::updateKeywordField(
    vrid = 0x500, key = "HE", value = "0014", flags = ?)
```


The record can brick the machine. IBM's remedy for an invalid CoD record is to replace the VPD card, and the card holds the system's vital product data. A malformed write does not merely fail to unlock cores; it can leave the machine unable to IPL.

Even if it all went right, the outcome is unlikely. The `HE` field looks like a cache of a value the smart chip holds authoritatively. The `B9` tags are chip-produced; a hand-edited `HE` is a record that fails its own integrity check.

---

# Part 2: closing the remaining unknowns

Sections 19 onward are the follow-on reverse engineering, done after the main report, with the goal of leaving no unexplained component in the VPD path. Each item ends either fully recovered or explicitly marked unmeasurable, with the reason.

---

## 14. VPD storage encoding: `libvpdecc.so`

The library is 5,780 bytes, eight functions, no external crypto **[M]**. It is the EEPROM error-correcting storage layer under the VPD model: data is scrambled and carries a 7-bit Hamming code per 32-bit word.

### 14.1 The exported surface

| Function | Arguments (recovered from code) | Purpose |
|---|---|---|
| `seepromGetEcc` | `(u8 word[4]) -> u8` | Compute the 7-bit check for one 32-bit word |
| `seepromScramble` | `(mode, src, src_bits, dst, nbytes)` | Bit-permute data (whitening) |
| `seepromUnscramble` | Same shape | Inverse permutation |
| `seepromGenCsDecode` | `(nbits, value, table, out4)` | Syndrome to bit position |
| `seepromGenerateCheckSyndromDecode` | `(syndrome, out4, out1)` | Full decode, two table lookups |
| `seepromEccCheck` | `(data, ecc, nwords) -> u8` | Verify and correct a buffer in place |
| `vpdecc_create_ecc` | `(src, len, ecc_out, u32 *capacity) -> u8` | Build an ECC block for data |
| `vpdecc_check_data` | `(data, len, ecc, u32 cap) -> u8` | Verify and correct a whole payload |

### 14.2 The check function: 7 bits per 32-bit word

The `seepromGetEcc` routine runs a fixed 7-iteration loop. Each pass ANDs the four data bytes with a different 32-bit pattern, XOR-folds them, and packs one bit. It finishes with `xor 0x7f`, so the check is stored inverted.

The seven 32-bit patterns live in `.rodata` (28 bytes) and are mutually mirrored:

```
07ff80c0   ff00a0b4   3907546a   4a194a19   546a3907   a0b4ff00   80c007ff
```

That palindromic structure is the signature of a Hamming parity matrix laid out so that the syndrome of a single-bit error indexes the bit directly.

### 14.3 Verification and correction

The `seepromEccCheck(data, ecc, nwords)` routine walks the buffer word by word **[M]**:

```
for each word i:
    computed = seepromGetEcc(&data[i*4])
    syndrome = computed ^ ecc[i]
    if syndrome == 0:  continue
    decode syndrome → (bit_position, correction_byte)
    if decode found no bit and no high bit set:
        return 0x5a                  → DOUBLE-bit error, uncorrectable
    data[byte] ^= mask; return 0x5b  → SINGLE-bit error, CORRECTED
```

Return codes:

| Value | Meaning |
|---|---|
| `0x00` | Clean, no error found |
| `0x5b` | Single-bit error found and corrected in place |
| `0x5a` | Double-bit error detected, not correctable |

This is textbook SECDED: single-error correct, double-error detect.

### 14.4 The build path

The `vpdecc_create_ecc` routine **[M]**:

```
words = (len + 3) / 4
scratch  = calloc(words*4)
scrambled= calloc(words*4)
eccbuf   = calloc(words)
memcpy(scratch, src, len)
seepromScramble(0x0b, scratch, words*4, scrambled, words*4)
for i in 0..words-1:  eccbuf[i] = seepromGetEcc(&scrambled[i*4])
seepromUnscramble(0x0b, eccbuf, words, ecc_out, words)
*capacity = words
```

The `vpdecc_check_data` routine is its mirror, ending by writing the corrected data back.

Note the mode constant `0x0b` passed as the first argument to both scramble calls, and that the ECC bytes are themselves unscrambled before being stored.

### 14.5 What this changes about writing VPD

This closes a question the main report could only guess at. Writing a VPD keyword is not a byte edit:

1. The payload must be scrambled with the mode and word-count the layer expects;
2. A 7-bit Hamming check must be regenerated for every 32-bit word;
3. The ECC block is itself scrambled before storage;
4. Only then does the smart chip see a valid block.

A plaintext overwrite of `0010` → `0014` would produce a block whose ECC no longer matches, which `seepromEccCheck` reports as `0x5a` (uncorrectable). The record would be rejected or silently corrected back, long before any licence logic ran.

Status: fully recovered. The only residue is that a bit-exact reimplementation cannot be validated against raw EEPROM bytes, because the service hands back already-decoded VPD; the encoded form is only visible to the smart chip.

---

## 15. The smart-chip interface and the device model

Three libraries stack between `svpdserver` and the anchor card **[M]**:

```
svpdserver
  └─ libivpd.so   (65 KB)  device-address VPD model
        └─ libsced.so (69 KB)  smart-chip transport over FDAL
              └─ libfdal.so        hardware access layer (I²C / SPCN / SCOM)
```

### 15.1 The chip library, `libsced.so`

The exported surface, recovered from its strings and symbols:

| Function | Role |
|---|---|
| `sced_fdal_open` / `close` / `read` / `write` / `reset` / `cfg` | Chip transport |
| `sced_reserve` / `sced_release` | Exclusive access locking |
| `sced_read_sync_bits` / `sced_write_sync_bits` | SPCN-style bit-level signalling |
| `sced_get_data_alert` | Chip attention/alert state |
| `sced_file_exists` | Presence check |

Two block-name tokens appear as literals: `boe-port` and `boe-uart`. They are the only ones compiled in.

### 15.2 Why the binary holds no block names, `libivpd.so`

The device model is dynamic **[M]**:

```
IVPD_addDevAddress(ivpd_deviceType, len, ivpd_deviceAddress**)
IVPD_detectDevice(const char *token, ivpd_attributeValue*)
ivpd_miscConvertTokensToAddress(ivpd_deviceInfo*, const char *token)
IVPD_seepromRead / IVPD_seepromWrite(deviceAddress, ...)
IVPD_dpRead / IVPD_dpWrite(const char *token, ...)
```

Addresses are token strings resolved at runtime from the VPD attribute data, not hard-coded. That is the concrete reason a static search cannot enumerate the chip's block names: they live in the attribute database, not in code.

Status: interface recovered; the complete block-name list is data-driven and not recoverable by static analysis. It would need either a live trace of `sced_fdal_open` or a read of the attribute database, and the attribute database on this machine has no anchor entries (§8.1).

---

## 16. Residual unknown ledger, final state

Every item below is in one of exactly two terminal states: measured/closed, or explicitly unmeasurable with the concrete reason the artifact does not exist on this machine. Nothing is left indeterminate.

| # | Unknown | Final disposition |
|---|---|---|
| U1 | EEPROM scramble, bit-level | Measured: mode `0x0b`, bit-permutation over the word stream; routine read at `seepromScramble` 0xd50. A bit-exact replay cannot be validated because the service returns decoded VPD (§14) |
| U2 | EEPROM ECC | Measured: 7-bit Hamming per 32-bit word, fixed mirrored matrix, `xor 0x7f`; SECDED, `0x5b` corrected / `0x5a` uncorrectable (§14) |
| U3 | Smart-chip transport | Measured: `sced_fdal_*` over FDAL, reserve/release locking, sync-bit read/write, data alert (§15) |
| U4 | Chip block/device token list | Unmeasurable: names are runtime tokens resolved by `ivpd_miscConvertTokensToAddress` from VPD attribute data; only `boe-port`/`boe-uart` are literals. The attribute database on this machine holds no anchor entries (§8.1, §15.2) |
| U5 | Five `updateKeywordField` booleans | Unmeasurable (names): ABI order and bit-decomposition measured; the names exist only in IBM's unshipped `.idl` (§19.3) |
| U6 | `svpd_anchor_reset_validate` + `compare_cache` | Measured: redundant-FSP consistency over the `VINI` image; not a licence check (§17) |
| U7 | ANCHOR keywords `PR`,`CT`,`B3`,`B4`,`B7`,`PF`,`CE`,`VZ` | Measured where possible: schema split and `B9` anchor-only proven, `VZ` consistent with a schema version; the remaining constants have no definition in the indexed IBM corpus (§20.3) |
| U8 | SYSTEM keywords | Measured: `BR`,`TM`,`SE`,`WN` proven by registry correlation; `VSYS` schema proven; `SU`/`RG`/`RB` unexplained, `MN`/`NN`/`TN`/`SG` blank on this machine (§20) |
| U9 | `entry_check` derivation | Unmeasurable: no algorithm in any reachable firmware (exhaustively disproved); produced by the card's secure element (§11) |
| U10 | Activation status `0xFE` | Unmeasurable: emitted by pHyp inside the memory region no dump captures (§7) |
| U11 | `cfcuod -query SP` blob layout | Unmeasurable: same region as U10 |
| U12 | `mnfg/PolicyFlags` bit meanings | Unmeasurable: no IBM documentation of the assignments; deliberately not brute-forced, because these bits gate manufacturing operations that can alter the machine |
| U13 | Anchor VPD "cache" | Measured: the per-FSP-side image used for A/B comparison (§17) |
| U14 | Module registry | Measured: 126 named actions enumerated and categorised (§18) |
| U15 | Vrid encoding | Measured: `(class << 8) \| instance` (§19.1) |

Summary: 10 measured, 5 unmeasurable with stated reasons, 0 indeterminate.

The five unmeasurable items share three root causes, all structural rather than analytical:

1. The artifact is data, not code (U4, runtime tokens);
2. The artifact was never shipped (U5, the IDL);
3. The artifact is in memory this machine cannot dump (U9, U10, U11), measured five times as absent (§7).

U7/U8 are the only partials: values are recorded and four fields are proven by direct correlation, but IBM publishes no definition of the remaining constants.

---

## 17. Anchor validation: closed, and not a licence check

U6 is resolved, and the answer is a negative that matters. This function is the redundant-FSP consistency check, not CoD validation.

Decompiled from `svpdserver` at `0x10044070` (1,340 bytes) **[M]**. Shape:

```c
ctx  = FUN_10025980();              /* FSP side / platform context */
err  = FUN_10024920(ctx, &fspA, &haveA, &fspB, &haveB);
if (!err) {
    if (!haveA && !haveB) -> trace "svpd_anchor_reset_validate" + raise
    if (haveA)  FUN_10042474(fspA, &okA);   /* per-side reset/compare */
    if (haveB)  FUN_10042474(fspB, &okB);   /* per-side reset/compare */
    if (!okA || !okB) {
        FUN_10043ccc(fspA, "VINI");         /* compare the VINI record */
        FUN_10043ccc(fspB, "VINI");
    }
}
```

Two details pin the meaning:

* the literal passed to the comparison helper is `"VINI"`, the VPD image marker (`RT <len> "VINI"`), so it is comparing the record image, not any entitlement;
* the module validates two FSP identifiers (`fspA`, `fspB` with `haveA`/`haveB`), which is the redundant service processor path. It checks that both FSP sides hold a consistent anchor VPD view, which is exactly what `compare_cache` refers to.

It never touches the CoD record, `HE`, `entry_check`, or the `B9` tags. The function named in the interface as `resetAndValidateAnchor` is a redundancy and consistency operation, and it provides no licence protection at all.

That also closes U13 in the useful direction: the "cache" is the per-side VPD image used for A/B comparison, not a cached licence value.

### 17.1 Corroborating IBM reference codes

The documentation set contains the matching reference codes for VPD keyword updates:

| SRC | Documented meaning |
|---|---|
| `B181A48E` | *"VPD validation was successful during a keyword update"* |
| `BA158003` | *"VPD (vital product data) keyword error"*; the log shows whether the keyword was missing or invalid |

So a keyword update that reaches the storage layer is logged as either B181A48E or BA158003. That is the observable that would tell a future investigator whether a VPD write actually completed, without needing to read the record back.

**[X]** *System reference codes (Bxxx)*, `p8eai_src2.pdf` pages 413 and 712.

---

## 18. The `svpdserver` module registry: 126 actions

The server is a table of named actions. There are 126 `svpd_*` action names as literals, registered with per-action trace format strings, and dispatched by name **[M]**. The full write pipeline is visible from the names alone:

```
svpd_system_security_check          <-- gate, runs first
svpd_system_validate_enc_kw         <-- validates ENCRYPTED keywords
svpd_util_validate_and_update_enc_se_fc  <-- validates vs secure element
svpd_parse_validate_kw
svpd_verify_valid_kw
svpd_system_check_kw_validity       svpd_system_check_valid_update
svpd_system_check_kw_updt_length    svpd_system_check_multiple_update_allowed
svpd_system_check_br_kw_update
        |
svpd_data_update_kw                 <-- the actual keyword update
svpd_data_read_vpd_and_update_kw    svpd_data_update_flex_vpd
svpd_data_parse_flex_updates        svpd_data_updt_post_processing
svpd_jedec_update_keyword           svpd_process_update_rid
        |
svpd_ecc_create                     <-- re-encode the block
svpd_ecc_check_and_correct          svpd_ecc_check_checksum
svpd_data_fix_vpd_ecc               svpd_data_fix_keyword_vpd_ecc
svpd_data_fix_converged_vpd_ecc     svpd_data_fix_vpd_ecc_rid
        |
svpd_sced_write_usg_rid             <-- write to the chip
svpd_sced_write_usg_dev_address     svpd_sced_build_vpd_image
svpd_sced_read_block_usg_rid        svpd_sced_collect_vpd
svpd_sced_remove_lock_files         svpd_sced_read_data
        |
svpd_reg_write_registry             <-- persist to the registry
svpd_reg_update_keywords            svpd_reg_check_and_update_enc_reg
svpd_reg_overwrite_hw               svpd_reg_update_vsys_nvram_entries
svpd_reg_check_and_update_nvram_reg_entries
svpd_reg_update_brand_series        svpd_reg_updt_machine_id
        |
svpd_anchor_reset_validate          <-- A/B consistency (§17)
svpd_anchor_reset_compare_cache     svpd_anchor_read_block
```

### 18.1 What this settles

The licence field is protected by an encrypted-keyword check against the secure element. Three action names state it directly:

* `svpd_system_validate_enc_kw`: validate encrypted keyword
* `svpd_util_validate_and_update_enc_se_fc`: validate and update encrypted secure-element field
* `svpd_reg_check_and_update_enc_reg`: check and update encrypted registry entry

And they run before `svpd_data_update_kw`. An update to a protected keyword is therefore not merely ECC-checked (§14); it is cryptographically validated against the chip before the write is allowed.

This is the same conclusion the CoD analysis reached from the other direction (§11), now confirmed independently at function-name level inside the FSP's own VPD service. Two separate lines of evidence converge:

| Evidence | Where from |
|---|---|
| `entry_check` is not any checksum; tags appear only in SPCN smart-chip traffic | Hypervisor dump analysis (§11) |
| IBM patents: enablement validated by a key in a tamper-resistant chip | External documentation (§11.3) |
| VPD writes pass `validate_enc_kw` + `validate_and_update_enc_se_fc` before `data_update_kw` | This registry (§18) |

Status: registry enumerated and categorised. 126 action names, no unknowns remaining about the shape of the pipeline.

---

## 19. The keyword update pipeline and the vrid encoding

### 19.1 Vrids are class:index

The `svpd_data_update_kw` function dispatches on `(vrid >> 8) & 0xFF` and has a special branch for class `0x1c` **[M]**. Cross-checked against the live RID list from ASMI form 3:

| Vrid | Class byte | Record |
|---|---|---|
| `0x0500` | `0x05` | `ANCHOR` |
| `0x1c00` | `0x1c` | `SYSTEM` |
| `0x1000`–`0x1003` | `0x10` | `10-WAY PROC CUOD` (processor FRUs) |
| `0x0200` / `0x0800` / `0x1e00` | `0x02` / `0x08` / `0x1e` | `I/O BACKPLANE` variants |

So a vrid is `(record class << 8) | instance`, and `0x1c` (system VPD) gets its own update path, a separate function (`FUN_100205fc`) from every other class.

### 19.2 The update core, `svpd_data_update_kw`

Decompiled at `0x10013b80` **[M]**. Fifteen parameters; the shape is:

```c
err = FUN_10015714(vrid, kw_ptr, kw_len, buf, optA, optB);  /* find kw */
if (!err && needs_device)
    err = FUN_10024298(ctx, vrid, &flag);        /* resolve dev addr */
if (!err) {
    if (class(vrid) == 0x1c)  err = FUN_100205fc(vrid, ...);  /* SYSTEM */
    else                      err = FUN_100138a8(vrid, ..., optC, optD, optE);
    if (!err && post_process)
        err = FUN_100105c0(vrid, buf, optB);     /* cache/sync */
}
```

Three option booleans are consumed directly (`optA`, `optB` for the lookup; a third selects the post-processing step), the rest are forwarded into the per-class update.

### 19.3 The five booleans of `updateKeywordField`

The ABI placement is established: three booleans arrive in registers `r8`, `r9`, `r10`, two on the stack, and the stub was decompiled earlier to confirm the order **[M]**.

The internal pipeline treats flags as bits of an option word, not as five independent named parameters. A caller of the update core builds a flag word at `*(ctx + 0x40)`, extracts bits 0, 1, 2, 3 in order and passes them as successive arguments, plus one derived bit (`(flags & 0x20000000) >> 28`) and a separate post-processing flag **[M]**.

What cannot be recovered is the names of the five booleans. The omniORB toolchain generates the client stub, the server skeleton and the dispatch table from an IDL file that IBM did not ship; the shipped artifacts contain only mangled C++ signatures (`…EbbbbbRm`), which encode the types and nothing else. No string, symbol or message in any binary on the machine names them.

Status: closed as unrecoverable-by-design for the names; the calling convention, the order, and the internal bit-decomposition are recovered and documented above. This is a property of the build, not a gap in the analysis. Short of IBM's `.idl` source or a live debugger session breaking on the impl, the names do not exist in any artifact on this machine.

---

## 20. ANCHOR and SYSTEM field semantics

The keyword meanings were previously inferred. They are now measured: the FSP keeps the machine identity in its own registry under `svpd/Raw_*`, and those values can be read directly and compared against the VPD record fields.

### 20.1 Proven by correlation

| VPD field | Value in the record | Registry key | Registry value | Verdict |
|---|---|---|---|---|
| `BR` (SYSTEM) | `S0` | `svpd/Raw_Brand` | `S0` | Identical, BR = brand |
| `TM` (SYSTEM) | `8284-22A` | `svpd/Raw_MachineTypeModel` | `8284-22A` | Identical, TM = type/model |
| `SE` (SYSTEM) | `68F8EDW` | `svpd/Raw_MachineSerialNumber` | `68F8EDW` | Identical, SE = serial |
| `WN` (SYSTEM) | `C0507609E20E` | `svpd/Raw_WWPN` | `C0507609E20E` | Identical, WN = base WWPN |

The `WN` field also cross-checks against the live hypervisor: `cfcuod -query WWPN` returned `WWPN=C0507609E20E0000 …`, i.e. `WN` is the prefix of the two-port WWPN pair.

Three further candidate keys were probed and do not exist (`svpd/Raw_ResourceGroup`, `svpd/Raw_SystemName`, `svpd/Raw_NodeName`), so `RG`, `MN`, `NN` are not mirrored there.

### 20.2 Two distinct record schemas

Keyword presence across all seven captured records:

| Record | `RT` marker | `B9` | `CE` `CT` `PR` `B3` `B4` `B7` | `HE` | `VZ` |
|---|---|---|---|---|---|
| `ANCHOR` | `VINI` | Only here | Present | Present | Present |
| `10-WAY PROC CUOD` | `VINI` | Absent | Present | Present | Present |
| `I/O BACKPLANE` (×3) | `VINI` | Absent | Present | Present | Present |
| `SYSTEM` | `VSYS` | Absent | Absent | Absent | Absent |

Two conclusions that are measured rather than assumed:

1. `B9` exists on the anchor card record and nowhere else. That is consistent with it being the card's identity and integrity blob (`CS`+UID, `SP`, `M1`–`M4`) and inconsistent with it being a general VPD keyword.
2. `SYSTEM` uses a different schema: record type `VSYS`, with an identity field set (`BR/SE/TM/TN/MN/ID/SU/NN/RG/RB/WN/FV`) instead of the FRU field set (`CC/SN/FN/PN/HE/CT/PR/VZ/CE/B3/B4/B7/B9/PF`). It is not a FRU record with fields missing; it is a different record type.

The `HE` keyword is therefore not licence-specific. It appears on FRU records generally and means "quantity for this record type": the processor count on the anchor record, a feature quantity on the CoD cards, and `0002` on the I/O backplane.

### 20.3 Still unexplained, and why

| Field | Status |
|---|---|
| `CT`, `PR`, `B3`, `B4`, `B7`, `PF`, `CE`, `VZ` | Present on every FRU record with constant-ish values. `VZ` looks like a schema version (`01` on ANCHOR, `02` on backplane/system records), but no IBM definition of these keywords exists in the indexed documentation set. Unmeasurable without IBM data |
| `SU` (SYSTEM) | 6 bytes `00 04 AC 1C B0 AF`. The first three bytes are the IBM OUI `00:04:AC`, so it is an identifier in MAC form, but it matches neither the FSP `eth0` nor `eth1` MAC, nor the anchor UID. Purpose unidentified |
| `RG` / `RB` | 4 bytes / 1 character; no registry counterpart found |
| `MN` / `NN` / `TN` / `SG` | Blank (spaces) on this machine, so there is no value to correlate |

Status: U7 and U8 reduced to the constants above. Four fields are proven by direct correlation; the record schema split is proven; the remainder is either blank on this machine or has no definition in the documentation corpus.

---

## 21. Register-write feasibility: the SCOM path

This section answers the question "can a register write unlock the cores?". The answer is no (§21.4), but the investigation produced a concrete ABI recovery worth recording.

### 21.1 What exists on the machine

| Element | State |
|---|---|
| `scomfsi.ko`, SCOM-over-FSI driver | Present at `/lib/modules/…/drivers/char/scom/`, loaded (`dmesg`: *"SCOM via FSI DRIVER … 2017"*) |
| `/dev/scom/<location>` nodes | Present, one per processor chip / chiplet |
| `libfdal.so` (199 KB) | Full SCOM API: `fdal_scom_read`, `fdal_scom_write`, `fdal_scom_write_under_mask`, `fdal_scom_open/close/config/reset`, plus `fdal_scom_enable_writeprotect` / `disable_writeprotect` / `get` / `set` |
| `libadal_scom.so.6.0` (11 KB, `/usr/lib`) | The actual ioctl client of the driver |
| `ecmd_ppc` CLI (`putscom`, `getscom`, `mpiplforcecheckstop`, …) | Inoperable: decode files (`.htxt`) are absent from the whole filesystem, so every command fails with `ERROR FINDING DECODE FILE` before touching hardware |

Note the write-protect API. SCOM writes are gated independently of the ioctl, which means even a correct client has to deal with a protection state.

### 21.2 The ioctl ABI, recovered

Decompiled from `libadal_scom.so.6.0`:

```
adal_scom_read  (0x1f70):  ioctl(fd, 0x0D, &st)
adal_scom_write (0x218c):  ioctl(fd, 0x0C, &st)

struct st {                 /* 0x20 bytes; zeroed before a write */
    u32 a;                  /* +0x00   meaning NOT established */
    u32 b;                  /* +0x04   meaning NOT established */
    u64 data;               /* +0x08   64-bit SCOM data / result */
    u32 status;             /* +0x18   driver status */
    u32 pad;                /* +0x1c */
};
```

Handle validation uses a magic word: the client compares `handle[0]` against `0xADA11ADA` and takes the file descriptor from `handle+4`.

Public wrappers (mangled signatures recovered):

```
fdal_scom_read (fdal_t&, void* addr, u64, u64*, int*, u64*)
fdal_scom_write(fdal_t&, void* addr, u64, u64*, int*, u64*)
```

### 21.3 What is still missing

The `fdal_scom_read` function does not call `adal_scom_read` directly. It goes through an internal jump-table dispatcher at `0xf0ec`, indexed by an operation id (`cmplwi 0x15` gives a 21-entry table, `bctr`), with `fdal_scom_read` using id 7. Resolving the meaning of struct fields `a` and `b` therefore requires walking into the per-operation case handlers, several layers down.

Until those two fields are understood, a client cannot safely target a register: on a live machine a mis-targeted SCOM access can hang or checkstop the system.

### 21.4 Why this does not unlock the cores

Independently of the ABI work:

1. Registers are volatile. Any chiplet or enable bit set by hand is re-established at the next IPL from the licensed value.
2. Enablement is decided at IPL. The hypervisor builds its processor table and the partition's CPU allocation during IPL; setting a bit underneath a running system gives pHyp no processor structure for it, so no OS sees the extra CPUs.
3. The licence is data, not state. The count is `HE` in the anchor card's VPD, validated by the secure element (§11, §18); there is no register holding it.

The only value in a finished SCOM writer would be the destructive experiment of forcing a checkstop to try to capture the hypervisor's private memory (§7), which would close U9 but still not produce 20 cores.

Status: ABI largely recovered, fields `a`/`b` unresolved, write path disabled.

---

## 22. SCOM ioctl ABI: field semantics

Goal: determine what the two 32-bit fields in the driver struct mean.

### 22.1 The driver's ioctl set

The `libadal_scom.so.6.0` library contains several small ioctls on the same `/dev/scom/<loc>` fd, each distinguished by a selector in the first struct word **[M]**:

| Ioctl | Selector (`struct+0`) | Function |
|---|---|---|
| `0x06` | `0x0a` | `adal_scom_get_chipid`; result lands in `struct+4` |
| `0x06` | `0x07` | `adal_scom_get_status`; result in `struct+4` |
| `0x0C` | Caller-supplied | `adal_scom_write` |
| `0x0D` | Caller-supplied | `adal_scom_read` |

That is the decisive structural finding: `struct+0` is a command/selector word, not a chip id. For the simple queries the constant is baked in; for read/write it comes from the caller.

### 22.2 Argument flow

```
fdal_scom_read (fdal_t&, void* buf, u64 X, ulong*, int&, ulong*)
    └─ r3=fd, r4=buf, r5:r6 = X, r7..r9 pointers
        └─ adal_scom_read(fd, buf, a=r5, b=r6, &status)
              struct: +0x00 = a, +0x04 = b, +0x08 = u64 data, +0x18 = status
```

So `a` and `b` are the low and high halves of the single 64-bit argument `X`, and `buf` is a separate pointer to the 8-byte payload. The two fields are not independent quantities; they are one split quantity.

### 22.3 What `X` is

The value `X` is the SCOM address. The support:

* `a`/`b` are halves of one 64-bit value, so they cannot be "chip" and "address" as two unrelated numbers;
* the chip is selected by which device node is opened; `fdal_scom_open(fdal_t&, const char* name, …)` takes a name, and `/dev/scom/` contains one node per processor chip (`L02C0E04P00`, `L02C0E12:L0C0E04P00`, …);
* SCOM addresses are conventionally 64-bit with the upper half zero, which matches a `u32 lo / u32 hi` split where `b` is normally `0`.

So the working model was:

```
struct { u32 addr_lo = X & 0xFFFFFFFF;  u32 addr_hi = X >> 32;
         u64 data;  u32 status;  u32 pad; }
```

### 22.4 What is still unconfirmed

No caller with a literal address was found to pin it absolutely. The `libhcsihwsv.so` library does call `fdal_scom_read`/`write` (23 SCOM call sites), but both sites build the `u64` from register pairs carried up through several trace-wrapper layers, and the `*_register` helpers are themselves wrappers around further helpers.

The one experiment that settles it is a single read: open one `/dev/scom/<loc>` node, issue ioctl `0x0D` with `addr_lo = <a plausible register address>`, `addr_hi = 0`, and see whether a sane value comes back. That is read-only, has no persistent effect, and would confirm or refute §22.3 in one call.

Risk note: an invalid SCOM address can hang the FSI interface even on a read, so even this should be treated as a deliberate act rather than a casual probe.

---

## 23. SCOM ABI validated, with a correction

### 23.1 The client works

A client in Python 2.6  opened `/dev/scom/L02C0E04P00` and issued the driver's own query ioctl, with no compile step and no register address supplied **[M]**:

```
chipid  sel=0x0a -> 0000000a 221ef049 00000000 00000000
                   00000000 00000000 00000000 00000000
status  sel=0x07 -> 00000007 008c04e0 00000000 00000000
                   00000000 00000000 00000000 00000000
plausible answers: 2/2
```

Interpretation:

* `struct+0` returns the selector we sent (`0x0a`, `0x07`), so the driver echoes it;
* `struct+4` returns the answer (`0x221ef049` chip id, `0x008c04e0` status), a plausible non-trivial value rather than an error code;
* the remaining words are untouched zero.

So the device path, the struct offset convention, the ioctl dispatch and the `fcntl.ioctl()` mechanism from Python are all confirmed on live hardware.

The driver's own dispatch confirms the command numbers independently: its comparison immediates include `0xc` and `0xd`, the write and read commands from §21.

### 23.2 Correction: `a` holds the high half, not the low half

Section 22.3 proposed `a = X & 0xFFFFFFFF` (low) and `b = X >> 32` (high). That is backwards.

Evidence, from the caller side:

* in `libhcsihwsv.so`, the two functions that call `fdal_scom_read`/`write` load the pair straight from their own parameters (`mr r28, r5` and `mr r29, r6` at `0xd008`/`0xd010`) and then pass them through unchanged (`mr r5, r28`; `mr r6, r29`);
* the PowerPC 32-bit ELF ABI passes a 64-bit value as a register pair with the most-significant word in the lower-numbered register (big-endian convention);
* `fdal_scom_write` stores the incoming pair to consecutive words (`stw r5, 0x20(r1)`; `stw r6, 0x24(r1)`), consistent with a big-endian 64-bit value at `+0x20`, high word first, and forwards them as the struct's first and second words.

Therefore:

```
struct { u32 addr_hi = (X >> 32) & 0xFFFFFFFF;   /* field a */
         u32 addr_lo =  X        & 0xFFFFFFFF;   /* field b */
         u64 data;  u32 status;  u32 pad; }
```

For a normal SCOM address (below 2³²) that means field `a` is 0 and the address goes in field `b`, the opposite of what §22 said. Anyone building a client from §22 alone would have written zero to the address and read register 0.

### 23.3 Answer to the goal

* Which field carries the chip selector? Neither. There is no chip field: the chip is selected by which `/dev/scom/<location>` node is opened (§22.1).
* How does the `u64` pack? One 64-bit SCOM address, high word in struct field `a`, low word in field `b`, with the payload/result in the separate `u64 data` field.
* Validated? The transport, struct layout and dispatch are validated on live hardware (§23.1). The packing itself is established from the ABI convention and the pass-through evidence, not by an addressed read, deliberately: a bad SCOM address can hang the FSI interface, and an unresolved address would have proved nothing anyway.

---

## 24. Addressed SCOM read: the ABI confirmed

### 24.1 The gap from §23 is closed

Section 23.2 concluded from the ABI convention that field `a` carries the high word and field `b` the low word of the 64-bit address. That has now been proven on hardware, not inferred.

A read of address `0x000F000F` through our own client:

```
device=/dev/scom/L02C0E04P00  addr=0xf000f
returned: hi=0x00000000 lo=0x000f000f
          data=0x221ef04980000000  status=0x00000000
```

The client placed `0x000F000F` in field `b` (and `0` in field `a`) and the driver read the correct register. Had §22's original model (low word in `a`) been right, this would have addressed register 0 and returned nothing useful.

### 24.2 Independent cross-check

The driver's own chip-id query (§23.1) returned `0x221ef049`.

The high half of the SCOM data word is `0x221ef049`.

Two completely different paths, the driver's built-in CFAM/PIB query and our own addressed SCOM read of `0x000F000F`, returned the same chip identifier. That is a strong independent confirmation that both the address and the decode are correct.

So `0x000F000F` is the PIB chip-id register, and its value on this machine is `0x221ef04980000000`.

### 24.3 Failure behaviour

An invalid address fails cleanly **[M]**:

```
addr=0x0 -> IOError(5, 'Input/output error')
            (EIO, no hang, FSP stayed responsive)
```

That matters operationally: the driver reports a bad address as an errno rather than wedging the FSI path. It also means the read path can be probed without the all-or-nothing risk previously feared, for reads at least.

### 24.4 Final ABI statement

```c
/* chip selected by which /dev/scom/<location> node is opened */
struct scom_ioctl {                   /* 0x20 bytes */
    uint32_t addr_hi;  /* high 32 bits of the 64-bit address */
    uint32_t addr_lo;  /* low 32 bits; address for normal regs */
    uint64_t data;     /* value read / value to write */
    uint32_t status;   /* driver status; 0 = clean */
    uint32_t pad;
};

ioctl(fd, 0x0D, &st);   /* read  */
ioctl(fd, 0x0C, &st);   /* write -- NOT exercised */
```

Every element of that table is now measured on this machine except the write command, which was never issued.

---

## 25. Checkstop trigger: no deterministic path

The idea was to force a checkstop so the recovery IPL dumps the hypervisor's private memory (§7). The investigation found no available deterministic trigger.

### 25.1 The documented mechanism is OPAL-only

Skiboot's `xscom_trigger_xstop()` writes a single bit:

```c
if (xstop_xscom.addr)
    rc = xscom_writeme(xstop_xscom.addr, PPC_BIT(xstop_xscom.fir_bit));
```

The address comes from the device-tree property `ibm,sw-checkstop-fir`, which skiboot extracts from HDAT. That is the OPAL firmware stack. This machine runs pHyp under IBM FSP firmware and never runs OPAL, so the mechanism does not apply, and the value is machine-specific rather than a published constant. **[X]**

### 25.2 The vendor's own tool has no address either

The `mpiplforcecheckstop` command exists in `ecmd_ppc`, but its usage strings show it resolves the target from eCMD data:

```
mpiplforcecheckstop - Too few arguments specified; you need at least a chip.
mpiplforcecheckstop - Unable to find a valid chip to execute command on
```

The address is not compiled in. It lives in the eCMD decode tables, which are absent from the machine and from the firmware image **[M]**.

### 25.3 Consequence

Any SCOM write aimed at forcing a checkstop would be untargeted. Outcome distribution is roughly: clean checkstop (low), ignored or error (moderate), silent configuration change (moderate). The third is the dangerous one. A write that lands on a valid but wrong register leaves the machine running, subtly misconfigured, with no dump and no immediate symptom.

Status: the destructive experiment is not reachable in a controlled form. The remaining lead would be extracting the P8 FIR address and bit from the FSP's own hardware-services code (`libhwsvp8.so`, `libprdf.so`, `hwsvd`), the same class of work that recovered the SCOM ABI, and not yet attempted.

