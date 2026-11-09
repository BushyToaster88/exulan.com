// Mosaic generator and ripple timing, ported from the Exuael branding repo
// (exuael-branding/video/src/core.js, itself ported from exuael-website's MosaicBuilder).
// Everything here is a pure function of the seed and of time.

// ── PRNG (SplitMix32 seeding a xoshiro128**) ────────────────────────
const rotl32 = (x: number, k: number) => (x << k) | (x >>> (32 - k))

class SplitMix32 {
	private state: number

	constructor(seed: number) {
		this.state = seed & 0xFFFFFFFF
	}

	next(): number {
		this.state += 0x9E3779B9
		let z = this.state & 0xFFFFFFFF
		z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B) & 0xFFFFFFFF
		z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35) & 0xFFFFFFFF
		return z ^ (z >>> 16)
	}
}

export class Xoshiro128StarStar {
	private s0: number
	private s1: number
	private s2: number
	private s3: number

	constructor(seed: number) {
		const sm = new SplitMix32(seed)
		this.s0 = sm.next() & 0xFFFFFFFF
		this.s1 = sm.next() & 0xFFFFFFFF
		this.s2 = sm.next() & 0xFFFFFFFF
		this.s3 = sm.next() & 0xFFFFFFFF
	}

	next(): number {
		const result = Math.imul(rotl32(Math.imul(this.s1, 5), 7), 9)
		const t = (this.s1 << 9) & 0xFFFFFFFF
		this.s2 ^= this.s0
		this.s3 ^= this.s1
		this.s1 ^= this.s2
		this.s0 ^= this.s3
		this.s2 ^= t
		this.s3 = rotl32(this.s3, 11)
		return result
	}

	random(): number {
		return (this.next() >>> 0) / 0xFFFFFFFF
	}

	uniform(min: number, max: number): number {
		return min + this.random() * (max - min)
	}

	randIntBelow(limit: number): number {
		return Math.floor(this.random() * limit)
	}
}

// ── Easing ──────────────────────────────────────────────────────────
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** Same maths as a CSS `cubic-bezier()` timing function. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const cx = 3 * x1
	const bx = 3 * (x2 - x1) - cx
	const ax = 1 - cx - bx
	const cy = 3 * y1
	const by = 3 * (y2 - y1) - cy
	const ay = 1 - cy - by

	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
	const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

	const solveT = (x: number) => {
		let t = x
		for (let i = 0; i < 8; i++) {
			const err = sampleX(t) - x
			if (Math.abs(err) < 1e-6) {
				return t
			}

			const d = sampleDX(t)
			if (Math.abs(d) < 1e-6) {
				break
			}

			t -= err / d
		}

		let lo = 0
		let hi = 1
		t = x
		while (lo < hi) {
			const v = sampleX(t)
			if (Math.abs(v - x) < 1e-6) {
				return t
			}

			if (x > v) {
				lo = t
			}
			else {
				hi = t
			}

			t = (hi - lo) / 2 + lo
			if (hi - lo < 1e-7) {
				break
			}
		}

		return t
	}

	return (x: number) => {
		if (x <= 0) {
			return 0
		}

		if (x >= 1) {
			return 1
		}

		return sampleY(solveT(x))
	}
}

/** The brand mosaic's easing: cubic-bezier(0.76, 0, 0.24, 1). */
export const brandEase = cubicBezier(0.76, 0, 0.24, 1)

// ── Mosaic generation ───────────────────────────────────────────────
class Cell {
	constructor(readonly x: number, readonly y: number, readonly size: number) {}

	get id() {
		return `${this.x},${this.y}`
	}

	get cx() {
		return this.x + this.size / 2
	}

	get cy() {
		return this.y + this.size / 2
	}

	topRight() {
		return new Cell(this.x + this.size, this.y, this.size)
	}

	bottomLeft() {
		return new Cell(this.x, this.y + this.size, this.size)
	}

	bottomRight() {
		return new Cell(this.x + this.size, this.y + this.size, this.size)
	}

	merged() {
		return new Cell(this.x, this.y, this.size * 2)
	}

	isTopLeftOfBlock(index: Map<string, Cell>, consumed: Set<Cell>): boolean {
		for (const other of [this.topRight(), this.bottomLeft(), this.bottomRight()]) {
			const found = index.get(other.id)
			if (found?.size !== this.size || consumed.has(found)) {
				return false
			}
		}

		return true
	}
}

export type MosaicConfig = {
	passes: number
	bias: number
	maxAspect: number
	minCells: number
	splitPower: number
	gcdMin: number
	gcdPower: number
	maxPct: number
}

export const MOSAIC_DEFAULTS: MosaicConfig = {
	passes: 6,
	bias: 0.6,
	maxAspect: 4,
	minCells: 4,
	splitPower: 1,
	gcdMin: 4,
	gcdPower: 0,
	maxPct: 15,
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

class Subdivider {
	private readonly cellStep: number

	constructor(private readonly cfg: MosaicConfig, private readonly maxCells: number | null) {
		this.cellStep = Math.max(1, cfg.minCells >>> 2)
	}

	decomposeRect(w: number, h: number, rng: Xoshiro128StarStar): Cell[] {
		const out: Cell[] = []
		this.split(0, 0, w, h, rng, out, 0, true)
		return out
	}

	run(cells: Cell[], rng: Xoshiro128StarStar): Cell[] {
		const out: Cell[] = []
		for (const cell of cells) {
			this.split(cell.x, cell.y, cell.size, cell.size, rng, out, 0, false)
		}

		return out
	}

	private splitProb(size: number): number {
		const { minCells, bias, splitPower } = this.cfg
		if (size <= minCells || size < minCells * 2) {
			return 0
		}

		if (this.maxCells != null && size > this.maxCells) {
			return 1
		}

		return bias * (1 - (minCells * 2 / size) ** splitPower)
	}

	private pickCut(size: number, rng: Xoshiro128StarStar): number | null {
		const { minCells, maxAspect, gcdMin, gcdPower, splitPower } = this.cfg
		const step = this.cellStep
		const loRaw = Math.max(Math.ceil(size / (maxAspect + 1)), minCells)
		const hiRaw = Math.min(Math.floor((size * (maxAspect - 1)) / maxAspect), size - minCells)
		if (loRaw > hiRaw) {
			return null
		}

		const lo = Math.ceil(loRaw / step) * step
		const hi = Math.floor(hiRaw / step) * step
		if (lo > hi) {
			return null
		}

		const candidates: number[] = []
		for (let k = lo; k <= hi; k += step) {
			if (gcdMin > 1 && gcd(size - k, k) < gcdMin) {
				continue
			}

			candidates.push(k)
		}

		if (candidates.length === 0) {
			return null
		}

		if (candidates.length === 1) {
			return candidates[0]
		}

		const weights = candidates.map(k => k ** splitPower * gcd(size, k) ** gcdPower)
		const total = weights.reduce((a, b) => a + b, 0)
		let r = rng.random() * total
		for (let i = 0; i < candidates.length; i++) {
			r -= weights[i]
			if (r <= 0) {
				return candidates[i]
			}
		}

		return candidates.at(-1) ?? null
	}

	private split(x: number, y: number, w: number, h: number, rng: Xoshiro128StarStar, out: Cell[], depth: number, force: boolean): void {
		if (w <= 0 || h <= 0) {
			return
		}

		if (w === h) {
			if (!(depth === 0 && force && w > this.cfg.minCells * 2)) {
				const prob = this.splitProb(w)
				if (prob <= 0 || rng.random() > prob) {
					out.push(new Cell(x, y, w))
					return
				}
			}

			const k = this.pickCut(w, rng)
			if (k === null) {
				out.push(new Cell(x, y, w))
				return
			}

			const corner = rng.randIntBelow(4)
			const recurse = (cx: number, cy: number, cw: number, ch: number) => this.split(cx, cy, cw, ch, rng, out, depth + 1, false)

			if (corner === 0) {
				recurse(x, y, k, k)
				recurse(x + k, y, w - k, k)
				recurse(x, y + k, w, h - k)
			}
			else if (corner === 1) {
				recurse(x + w - k, y, k, k)
				recurse(x, y, w - k, k)
				recurse(x, y + k, w, h - k)
			}
			else if (corner === 2) {
				recurse(x, y + h - k, k, k)
				recurse(x + k, y + h - k, w - k, k)
				recurse(x, y, w, h - k)
			}
			else {
				recurse(x + w - k, y + h - k, k, k)
				recurse(x, y + h - k, w - k, k)
				recurse(x, y, w, h - k)
			}
		}
		else if (w > h) {
			this.split(x, y, h, h, rng, out, depth + 1, false)
			this.split(x + h, y, w - h, h, rng, out, depth + 1, false)
		}
		else {
			this.split(x, y, w, w, rng, out, depth + 1, false)
			this.split(x, y + w, w, h - w, rng, out, depth + 1, false)
		}
	}
}

class Merger {
	constructor(private readonly maxCells: number | null) {}

	compact(cells: Cell[]): Cell[] {
		while (true) {
			const result = this.pass(cells)
			if (result.length === cells.length) {
				return result
			}

			cells = result
		}
	}

	private pass(cells: Cell[]): Cell[] {
		const index = new Map<string, Cell>()
		for (const cell of cells) {
			index.set(cell.id, cell)
		}

		const consumed = new Set<Cell>()
		const merged: Cell[] = []
		for (const cell of cells) {
			if (consumed.has(cell)) {
				continue
			}

			if (cell.isTopLeftOfBlock(index, consumed)) {
				const block = cell.merged()
				if (this.maxCells != null && block.size > this.maxCells) {
					continue
				}

				consumed.add(cell)
				consumed.add(index.get(cell.topRight().id)!)
				consumed.add(index.get(cell.bottomLeft().id)!)
				consumed.add(index.get(cell.bottomRight().id)!)
				merged.push(block)
			}
		}

		for (const cell of cells) {
			if (!consumed.has(cell)) {
				merged.push(cell)
			}
		}

		return merged
	}
}

function generateMosaic(gridW: number, gridH: number, config: MosaicConfig, rng: Xoshiro128StarStar): Cell[] {
	const step = Math.max(1, config.minCells)
	const gw = Math.max(1, Math.floor(gridW / step) * step)
	const gh = Math.max(1, Math.floor(gridH / step) * step)
	const maxCells = Math.floor((Math.max(gw, gh) * config.maxPct) / 100)
	const subdivider = new Subdivider(config, maxCells > 0 ? maxCells : null)
	const merger = new Merger(maxCells > 0 ? maxCells : null)

	let cells = subdivider.decomposeRect(gw, gh, rng)
	cells = merger.compact(cells)

	for (let pass = 1; pass < config.passes; pass++) {
		cells = subdivider.run(cells, rng)
		cells = merger.compact(cells)
	}

	return cells
}

// ── Time-addressable mosaic ─────────────────────────────────────────
export type MosaicSquare = {
	/** Centre, in pixels. */
	cx: number
	cy: number
	/** Side length, in pixels. */
	s: number
	/** Relative size, 0 (smallest) to 1 (largest). */
	k: number
	/** Seconds this square takes to pop in. */
	dur: number
	/** Ripple order, 0 (epicentre) to 1 (farthest). */
	rank: number
}

export type MosaicOptions = {
	width: number
	height: number
	cellSize?: number
	gap?: number
	seed?: number
	jitter?: number
} & Partial<MosaicConfig>

export class Mosaic {
	readonly squares: MosaicSquare[]

	constructor({ width, height, cellSize = 8, gap = 1, seed = 1, jitter = 0, ...cfg }: MosaicOptions) {
		const config: MosaicConfig = { ...MOSAIC_DEFAULTS, ...cfg }

		const rng = new Xoshiro128StarStar(seed)
		const gridW = Math.max(1, Math.floor(width / cellSize))
		const gridH = Math.max(1, Math.floor(height / cellSize))
		const cells = generateMosaic(gridW, gridH, config, rng)

		const maxCellX = Math.max(...cells.map(c => c.x + c.size))
		const maxCellY = Math.max(...cells.map(c => c.y + c.size))
		const offX = (width - maxCellX * cellSize) / 2
		const offY = (height - maxCellY * cellSize) / 2

		const maxSize = Math.max(...cells.map(c => c.size))
		const sizes = cells.map(c => c.size).sort((a, b) => a - b)
		const minRef = Math.max(1, sizes[Math.floor(sizes.length * 0.1)] ?? 1)

		const erng = new Xoshiro128StarStar(seed + 1)
		const epicentreCell = cells[erng.randIntBelow(cells.length)]
		const epi = { x: offX + epicentreCell.cx * cellSize, y: offY + epicentreCell.cy * cellSize }

		const squares = cells.map(c => {
			const px = offX + c.x * cellSize + gap
			const py = offY + c.y * cellSize + gap
			const sz = c.size * cellSize - gap * 2
			const cx = px + sz / 2
			const cy = py + sz / 2
			return {
				cx,
				cy,
				s: sz,
				k: maxSize > minRef ? clamp((c.size - minRef) / (maxSize - minRef)) : 1,
				dist: Math.hypot(cx - epi.x, cy - epi.y) + erng.uniform(-jitter, jitter),
				dur: 0.1 + 0.35 * Math.sqrt(c.size / maxSize),
				rank: 0,
			}
		}).filter(sq => sq.s > 0)

		squares.sort((a, b) => a.dist - b.dist)
		const n = squares.length
		squares.forEach((sq, i) => {
			sq.rank = n > 1 ? i / (n - 1) : 0
		})

		this.squares = squares
	}

	/**
	 * Progress (0..1) of a square at time `t` for a ripple that starts at `start`
	 * and takes `spread` seconds to reach the last square.
	 */
	static progress(sq: MosaicSquare, t: number, start: number, spread: number, reverse = false): number {
		const order = reverse ? 1 - sq.rank : sq.rank
		return brandEase(clamp((t - start - order * spread) / sq.dur))
	}
}
