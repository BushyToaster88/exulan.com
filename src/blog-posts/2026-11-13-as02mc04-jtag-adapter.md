---
title: "A JTAG adapter for the Alibaba AS02MC04 FPGA card"
desc: "A small board that plugs a Digilent HS3 onto the card's 6-pin JTAG header."
metaDesc: "A small JLCPCB-assembled adapter between the Digilent JTAG-HS3 and the 6-pin 1.8 V JTAG header of the Alibaba Cloud AS02MC04 (Xilinx XCKU3P) FPGA card: pinout, protection parts, what it cost and the first test on the real card."
date: 2026-11-13T22:00+11:00
edit: 2026-11-22T16:45+11:00
thumbnail: "thumb.png"
tags: ["FPGA", "JTAG", "AS02MC04", "XCKU3P", "Digilent HS3", "KiCad", "JLCPCB", "PCB"]
id: "2026-11-13-as02mc04-jtag-adapter"
---

I wanted to have some fun with an FPGA, so I bought an Alibaba Cloud AS02MC04 on eBay for US$196.33. It is one of the ex-datacentre network cards with a Xilinx Kintex UltraScale+ XCKU3P on it (the label on mine says YZQT-02337-101). I also have a Digilent JTAG-HS3. They do not plug into each other: the card has a single row of six pins at 2.54 mm, and the HS3 has the usual Xilinx plug, two rows of seven at 2.00 mm.

I could have used six jumper wires. But one of the six pins is the card's 1.8 V rail, and I did not trust myself to get the wires right every time, so I had a small board made.

> [!NOTE]
> Update, 22 November: the boards have arrived and the first one works. The HS3 reads the FPGA's device ID through it. The details are in [Does it work](#does-it-work) at the end. The pictures of the board are still 3D renders from KiCad, not photos.

![Renders of the adapter from five angles](showcase.webp)

## Who did what

Claude drew this board, over about three days of back and forth with me. It wrote one Python file that describes the circuit, plus scripts that build the KiCad 10 schematic and board from that file and run KiCad's electrical and design rule checks on them. Another script exports the files JLCPCB wants.

I took a photo of the header on the card, held a printed gauge against the connectors, chose the shipping and paid.

## The design

### The header on the card

J4 sits at the rear end of the card, the end away from the bracket, on the heatsink side. It is a surface-mount pin header with no shroud and no key, so a socket can be pushed onto it either way round.

| J4 pin | Card silkscreen | Signal |
|---|---|---|
| 1 | `1V8` | 1.8 V from the card |
| 2 | `TMS` | TMS |
| 3 | `TDK` | TCK |
| 4 | `TDO` | TDO |
| 5 | `TDI` | TDI |
| 6 | `GND` | ground |

Pin 3 really is printed `TDK` on the card. It is TCK.

The card's JTAG runs at 1.8 V. The FPGA's configuration bank has an absolute maximum of 2.35 V, so a 3.3 V probe could damage it. The HS3 handles this by powering its output buffers from a reference pin, which the adapter connects to the card's own `1V8`.

### What is on the board

![Front of the board](render_front.webp)

The board is 24.0 x 29.55 mm, two layers, with every part on one side. The black header at the top is a Molex 87832-1420, which is the keyed header the HS3 plug is made for. The grey block at the bottom is a right-angle socket that slides onto J4, so the adapter stands upright on the card with the HS3 pointing out past the rear edge.

![Side view of the adapter standing on the card](how_it_sits.webp)

Between the two connectors:

- R9, 4.7 ohm, in series with the 1.8 V pin. With a dead short behind it, the card's rail supplies at most about 0.38 A (1.8 V across 4.7 ohm).
- Q1, a small MOSFET in the ground line. It only switches on when 1.8 V shows up on the correct pin. Without it, plugging the adapter on backwards would put the card's 1.8 V on the HS3's ground, which is the PC's ground through the USB cable.
- A red LED next to the word `REVERSED` that lights when the adapter is on backwards.
- 22 ohm in series with each of the four signals. The HS3 already has 100 ohm inside, so these are mainly somewhere to put a scope probe or cut a line.
- Six test holes along the top edge, and a 3 mm hole for a loop of cord to pull the adapter straight up off the header.

The back has the pin names and two reminders in white: 1.8 V only, and take the adapter off the card before plugging or unplugging the HS3. J4 is only held on by six small solder joints, and the HS3 sticking out sideways puts a lot of leverage on them.

![Back of the board](render_back.webp)

### Things I already know are not great

R9 is rated 0.75 W and would turn about 0.7 W into heat in a dead short. A thermal estimate (not a measurement) puts it somewhere between 105 and 145 C, against a limit of 155 C, and that is at room temperature. In a warm case it could go past the limit, so a fault should not be left connected. Two 10 ohm resistors in parallel would have been the better choice.

The LED runs from 1.8 V, which is barely enough for a red one. It will be dim, and it might not be visible at all.

R7 is a 10k resistor that holds Q1 off when no 1.8 V is present. Claude's last review before ordering suggested 1k instead, because with 10k a crossed pair of jumper wires, or a reversed socket that is only half pushed on, can turn Q1 partly on. I decided to live with that and ordered it as it was. If there is ever a revision D, it gets the 1k.

## Getting it made

### Checking the pitch with paper

Both pitches had to be right, 2.54 mm on the card header and 2.00 mm on the HS3, and I was not going to find out from a photo. Before ordering I printed a [1:1 gauge sheet](https://github.com/BushyToaster88/as02mc04-jtag-adapter/blob/main/docs/pitch_gauge.pdf) at 100 %, checked its 100 mm bar with a ruler, and held both connectors against it. They lined up with the 2.54 mm and 2.00 mm rows.

### Ordering

![JLCPCB's placement preview](jlcpcb_preview.webp)

JLCPCB makes the board and solders the parts on. The parts list has 12 lines, 15 parts in all. Fourteen are placed by machine. The socket for the card is a through-hole part that somebody solders by hand, and it has its own fee.

The thing to look at in JLCPCB's placement preview is the black header. If it is fitted half a turn round, the HS3's ground pins sit on the 1.8 V line, and nothing on the board protects against that. The gap in the header's wall has to face the 3 mm hole, and in the preview above it does. I also turned on "Confirm Parts Placement". The order page says the boards cannot go into production until I have confirmed JLCPCB's own placement drawing. The email asking me to confirm it came the day after I ordered. It gives 72 hours before the order goes ahead by itself. The drawing is behind the "DFM Analysis" link on the order page. It showed all 15 parts, the engineers had changed nothing, and the black header was the right way round, so I confirmed it on 15 November.

On the order form, the tighter outline tolerance is only offered on boards of 50 x 50 mm or more, so this one gets the regular ±0.2 mm. JLCPCB also takes only one coupon per order. I had two, and picking the second deselected the first.

### What it cost

What I paid, in US dollars, for five boards with all five assembled:

| | USD |
|---|---|
| Boards | 5.10 |
| Assembly and parts | 35.06 |
| DHL Express | 21.38 |
| New-user coupon | -10.00 |
| **Total** | **51.54** |

That was about A$75 on the day. Most of the assembly cost is fixed fees, so building two instead of five would have saved very little. I paid at 14:44 and JLCPCB had approved the files by 14:49.

### Ordering one yourself

The whole project is on GitHub at [BushyToaster88/as02mc04-jtag-adapter](https://github.com/BushyToaster88/as02mc04-jtag-adapter): the KiCad files, the scripts that generate them, and the README with the full ordering and bring-up steps. It is under the CERN-OHL-P v2 licence, so you can change it and have your own made.

If you have the same card and an HS3 and only want to order it, the three files JLCPCB needs are in the [`fab` folder](https://github.com/BushyToaster88/as02mc04-jtag-adapter/tree/main/fab): the Gerber zip, the parts list and the placement file.

Mine have arrived and the board works: the HS3 connects to the FPGA through it, as described below. I have not loaded a design through it yet.

The settings I used: FR-4, 2 layers, 1.6 mm, 1 oz copper, lead-free HASL, tented vias. For assembly: Economic, top side, parts selected by customer, "Confirm Parts Placement" set to Yes. All 12 lines of the parts list matched a part in stock when I ordered. In the placement preview, check that the gap in the wall of the black header faces the 3 mm hole, and that the socket lies over the empty part of the board with its openings at the edge with the cut-off corner. I also pasted this into the assembly remark box:

> J1 (C492354): keep the rotation from the CPL. The key slot of the shroud faces the board edge with the 3 mm hole. Do not turn it by 180 degrees.
> J2 (C54876735): symmetric 1x6 right-angle socket with no polarity. Its body lies on the board with the openings at the edge that has the chamfered corner. Do not rotate it.

## Does it work

The boards were ordered on 13 November and I had one plugged in on 22 November. The card is in a PCIe slot in a server running Ubuntu 24.04, with the adapter on J4 and the HS3 on the adapter.

The plan was to use openFPGALoader, but it is not installed on that server and OpenOCD 0.12.0 is, so Claude logged in over SSH and used that instead, at the same cautious 6 MHz:

```bash
openocd -f interface/ftdi/digilent_jtag_hs3.cfg \
  -c "transport select jtag; adapter speed 6000" \
  -c "jtag newtap xcku3p tap -irlen 6 -ircapture 0x1 -irmask 0x3 -expected-id 0x04a63093" \
  -c init -c scan_chain -c shutdown
```

```bash
Info : clock speed 6000 kHz
Info : JTAG tap: xcku3p.tap tap/device found: 0x04a63093 (mfg: 0x049 (Xilinx), part: 0x4a63, ver: 0x0)
   TapName             Enabled  IdCode     Expected   IrLen IrCap IrMask
-- ------------------- -------- ---------- ---------- ----- ----- ------
 0 xcku3p.tap              Y     0x04a63093 0x04a63093     6 0x01  0x03
```

One device in the chain, IDCODE `0x04A63093`, which is the XCKU3P. Five scans in a row gave the same answer with no errors.

The very first scan did print an error. Without the `jtag newtap` line OpenOCD has to guess how long the chip's instruction register is. It guessed 2 bits, the XCKU3P has 6, and it complained about what it read back. With the length given, the error goes away.

The server also sees the card on PCIe, as an Ethernet controller with the ID `dabc:1017`, so the image it shipped with is still running.

So the adapter does its job. Reading the ID uses all four JTAG signals and the 1.8 V reference, which are the same connections that loading a design uses. I have not loaded a bitstream through it yet, and I have not plugged it on backwards to try the reverse protection and the LED. Real photos are still to come.
