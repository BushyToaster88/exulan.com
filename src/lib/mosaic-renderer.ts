// Canvas renderer for the mosaic background.
//
// It is built to do as little work as it can, so it stays smooth on phones and low-end
// machines:
//
// - Animation frames are only requested while squares are actually moving. Through the
//   hold and the pause between cycles it sleeps on a timer, and it stops completely while
//   the tab is hidden.
// - While a ripple runs, only the squares that are mid-pop get repainted, instead of the
//   whole canvas being cleared and redrawn every frame.
// - The canvas is opaque, all geometry sits on whole pixels, and the backing store is
//   capped, so large or high-density screens do not multiply the work.
// - If frames keep arriving late anyway, it steps its own quality down: first to a lower
//   resolution at 30fps, and as a last resort to a still mosaic.

import { brandEase, Mosaic } from "@/lib/mosaic"

export type MosaicRendererOptions = {
	/** Opaque CSS colour painted behind the squares. */
	background: string
	/** Opacity of a fully popped square. */
	squareAlpha: number
	/** Fill for a square of relative size `k`, from 0 (smallest) to 1 (largest). */
	colorFor: (k: number) => string
	/** Grid cell size, in CSS pixels. */
	cellSize: number
	/** Inset on each side of a square, in CSS pixels. */
	gap: number
	/** Random amount added to each square's ripple distance, in CSS pixels. */
	jitter: number
	/** Seconds the ripple-in takes to reach the last square. */
	rippleIn: number
	/** Seconds between that moment and the start of the ripple-out. */
	hold: number
	/** Seconds the ripple-out takes to reach the last square. */
	rippleOut: number
	/** Seconds the canvas then stays empty before the next cycle. */
	pause: number
}

type Quality = {
	/** Most canvas pixels per CSS pixel. */
	maxScale: number
	/** Most canvas pixels overall. */
	maxPixels: number
	/** Frame rate cap while a ripple runs. */
	fps: number
	/** Average frame interval, in milliseconds, above which a ripple counts as struggling. */
	slowFrame: number
}

// Level 0 is full quality. The level only ever goes up (worse), one step at a time.
const QUALITY: readonly Quality[] = [
	{ maxScale: 2, maxPixels: 3840 * 2160, fps: 60, slowFrame: 28 },
	{ maxScale: 1, maxPixels: 1920 * 1080, fps: 30, slowFrame: 70 },
]

/** The level past the end of the table: no animation, just the settled mosaic. */
const STILL = QUALITY.length

/** Struggling ripples in a row before the quality drops a level. */
const STRIKES_TO_STEP_DOWN = 2

/** How long the container has to keep its size before the mosaic is rebuilt for it. */
const RESIZE_SETTLE_MS = 200

/**
 * A canvas up to this many CSS pixels larger than its container is left alone. Mobile
 * toolbars sliding in and out shrink the viewport by about this much, and rebuilding the
 * mosaic every time would restart the animation for no visible gain.
 */
const RESIZE_SLACK = 160

// The pop easing as a lookup table, so the bezier is not solved per square per frame.
const EASE_STEPS = 256
const EASE = new Float32Array(EASE_STEPS + 2)
for (let i = 0; i < EASE.length; i++) {
	EASE[i] = brandEase(Math.min(1, i / EASE_STEPS))
}

/** `brandEase` for `u` in [0, 1), read from the table. */
function ease(u: number): number {
	const position = u * EASE_STEPS
	const index = position | 0
	return EASE[index] + (EASE[index + 1] - EASE[index]) * (position - index)
}

/** One generated mosaic, flattened into typed arrays in ripple order. */
type Scene = {
	count: number
	/** Top-left corner and side length of each square, in canvas pixels. */
	x: Float32Array
	y: Float32Array
	size: Float32Array
	/** Position in the ripple, from 0 (epicentre) to 1 (farthest). */
	rank: Float32Array
	/** 1 / (seconds a square takes to pop). */
	rate: Float32Array
	color: string[]
}

type Phase = "idle" | "in" | "hold" | "out" | "pause" | "still"

function startingQuality(): number {
	// Only some browsers report device memory, so this is just a head start for the
	// smallest devices. The frame pacing check is what really decides.
	const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
	return memory !== undefined && memory <= 2 ? 1 : 0
}

/**
 * Runs the mosaic animation on `canvas`, sized to cover `container`.
 * Returns a function that stops it and releases everything it registered.
 */
export function createMosaicRenderer(
	canvas: HTMLCanvasElement,
	container: HTMLElement,
	options: MosaicRendererOptions,
): () => void {
	const context = canvas.getContext("2d", { alpha: false })
	if (!context) {
		return () => {}
	}

	const ctx: CanvasRenderingContext2D = context
	const { background, squareAlpha, rippleIn, rippleOut } = options
	const motionQuery = globalThis.matchMedia("(prefers-reduced-motion: reduce)")

	let quality = startingQuality()
	let strikes = 0
	let ripplesFinished = 0

	let scene: Scene | null = null
	/** Indices of the squares that are mid-pop, and how many of them there are. */
	let active = new Int32Array(0)
	let activeCount = 0
	/** Next square in ripple order that has not started yet. */
	let cursor = 0

	let phase: Phase = "idle"
	let seed = Math.floor(Math.random() * 0xFFFFFF) + 1
	let cycles = 0
	/** Container size, in CSS pixels, that the current scene was built for. */
	let builtWidth = 0
	let builtHeight = 0

	/** `performance.now()` when the current ripple started. */
	let epoch = 0
	/** `performance.now()` when the current hold or pause ends. */
	let wakeAt = 0
	let lastPaint = 0
	/** Frame pacing over the current ripple. */
	let lastTick = 0
	let tickTotal = 0
	let tickCount = 0

	let frame = 0
	let timer = 0
	let resizeTimer = 0
	let hiddenAt = 0
	let restartWhenVisible = false
	let destroyed = false

	function setPhase(next: Phase) {
		phase = next
		canvas.dataset.phase = next
	}

	function limits(): Quality {
		return QUALITY[Math.min(quality, QUALITY.length - 1)]
	}

	function isStill(): boolean {
		return quality >= STILL || motionQuery.matches
	}

	/** Sizes the canvas for the container, generates a new mosaic and clears to the background. */
	function build() {
		const width = Math.max(1, container.clientWidth)
		const height = Math.max(1, container.clientHeight)
		const { maxScale, maxPixels } = limits()

		let scale = Math.min(globalThis.devicePixelRatio || 1, maxScale)
		if (width * height * scale * scale > maxPixels) {
			scale = Math.sqrt(maxPixels / (width * height))
		}

		const pixelWidth = Math.max(1, Math.round(width * scale))
		const pixelHeight = Math.max(1, Math.round(height * scale))
		if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
			canvas.width = pixelWidth
			canvas.height = pixelHeight
		}

		if (builtWidth !== width || builtHeight !== height) {
			canvas.style.width = `${width}px`
			canvas.style.height = `${height}px`
			builtWidth = width
			builtHeight = height
		}

		canvas.dataset.quality = String(quality)

		// Work in canvas pixels with whole-number cells and gaps. Every square then lands on
		// exact pixel boundaries, so it stays crisp and can be wiped and repainted on its own
		// without leaving a fringe behind.
		const cell = Math.max(2, Math.round(options.cellSize * scale))
		const gap = options.gap > 0 ? Math.max(1, Math.round(options.gap * scale)) : 0
		const { squares } = new Mosaic({
			width: pixelWidth,
			height: pixelHeight,
			cellSize: cell,
			gap,
			seed,
			jitter: options.jitter * scale,
		})

		const count = squares.length
		const next: Scene = {
			count,
			x: new Float32Array(count),
			y: new Float32Array(count),
			size: new Float32Array(count),
			rank: new Float32Array(count),
			rate: new Float32Array(count),
			color: new Array<string>(count),
		}
		for (let i = 0; i < count; i++) {
			const square = squares[i]
			next.x[i] = Math.round(square.cx - square.s / 2)
			next.y[i] = Math.round(square.cy - square.s / 2)
			next.size[i] = square.s
			next.rank[i] = square.rank
			next.rate[i] = 1 / square.dur
			next.color[i] = options.colorFor(square.k)
		}

		scene = next
		if (active.length < count) {
			active = new Int32Array(count)
		}
		activeCount = 0

		ctx.globalAlpha = 1
		ctx.fillStyle = background
		ctx.fillRect(0, 0, pixelWidth, pixelHeight)
	}

	/** Paints every square at full size onto the freshly cleared canvas. */
	function paintSettled() {
		const current = scene
		if (!current) {
			return
		}

		ctx.globalAlpha = squareAlpha
		for (let i = 0; i < current.count; i++) {
			ctx.fillStyle = current.color[i]
			ctx.fillRect(current.x[i], current.y[i], current.size[i], current.size[i])
		}
		ctx.globalAlpha = 1
	}

	/**
	 * Paints one frame of the running ripple, `seconds` after it started.
	 * Returns true once every square has finished.
	 */
	function paintRipple(seconds: number): boolean {
		const current = scene
		if (!current) {
			return true
		}

		const leaving = phase === "out"
		const sweep = leaving ? rippleOut : rippleIn
		const { x, y, size, rank, rate, color } = current

		// Let in the squares whose turn has come. They are stored in ripple order, so this is
		// a walk forwards for the ripple-in and backwards for the ripple-out.
		if (leaving) {
			while (cursor >= 0 && (1 - rank[cursor]) * sweep <= seconds) {
				active[activeCount++] = cursor--
			}
		}
		else {
			while (cursor < current.count && rank[cursor] * sweep <= seconds) {
				active[activeCount++] = cursor++
			}
		}

		// Wipe just the squares that are mid-pop...
		ctx.globalAlpha = 1
		ctx.fillStyle = background
		for (let i = 0; i < activeCount; i++) {
			const square = active[i]
			ctx.fillRect(x[square], y[square], size[square], size[square])
		}

		// ...and repaint each at its current size. A square that has finished is painted one
		// last time (or left wiped, when leaving) and dropped from the list.
		let i = 0
		while (i < activeCount) {
			const square = active[i]
			const start = (leaving ? 1 - rank[square] : rank[square]) * sweep
			const progress = (seconds - start) * rate[square]
			const finished = progress >= 1
			const eased = finished ? 1 : ease(progress)
			const pop = leaving ? 1 - eased : eased

			if (pop > 0.001) {
				const side = size[square] * pop
				const inset = (size[square] - side) / 2
				ctx.globalAlpha = squareAlpha * pop
				ctx.fillStyle = color[square]
				ctx.fillRect(x[square] + inset, y[square] + inset, side, side)
			}

			if (finished) {
				active[i] = active[--activeCount]
			}
			else {
				i++
			}
		}
		ctx.globalAlpha = 1

		return activeCount === 0 && (leaving ? cursor < 0 : cursor >= current.count)
	}

	/** Looks at how the ripple that just ended was paced, and lowers the quality if it struggled. */
	function judgePace() {
		const timed = tickCount > 0 && tickTotal >= 1000
		const average = timed ? tickTotal / tickCount : 0
		tickTotal = 0
		tickCount = 0
		lastTick = 0

		// The very first ripple runs while the page is still loading, so it is not held
		// against the device.
		if (ripplesFinished++ === 0 || !timed || quality >= STILL) {
			return
		}

		if (average <= QUALITY[quality].slowFrame) {
			strikes = 0
		}
		else if (++strikes >= STRIKES_TO_STEP_DOWN) {
			quality++
			strikes = 0
			canvas.dataset.quality = String(quality)
		}
	}

	function unschedule() {
		if (frame) {
			cancelAnimationFrame(frame)
			frame = 0
		}
		clearTimeout(timer)
		timer = 0
	}

	/** Arranges whatever the current phase is waiting for: the next frame, or a wake-up. */
	function schedule() {
		if (destroyed || document.hidden) {
			return
		}

		if (phase === "in" || phase === "out") {
			if (!frame) {
				frame = requestAnimationFrame(tick)
			}
		}
		else if (phase === "hold" || phase === "pause") {
			clearTimeout(timer)
			timer = window.setTimeout(wake, Math.max(0, wakeAt - performance.now()))
		}
	}

	function wake() {
		timer = 0
		if (phase === "hold") {
			beginRipple("out")
		}
		else if (phase === "pause") {
			beginCycle()
		}
	}

	function beginRipple(direction: "in" | "out") {
		const current = scene
		if (!current) {
			return
		}

		setPhase(direction)
		cursor = direction === "in" ? 0 : current.count - 1
		activeCount = 0
		epoch = performance.now()
		lastPaint = 0
		lastTick = 0
		tickTotal = 0
		tickCount = 0
		schedule()
	}

	function beginCycle() {
		unschedule()
		if (destroyed) {
			return
		}

		if (document.hidden) {
			restartWhenVisible = true
			return
		}

		if (cycles++ > 0) {
			seed = (seed * 1664525 + 1013904223) % 0xFFFFFF + 1
		}

		build()

		if (isStill()) {
			paintSettled()
			setPhase("still")
			return
		}

		beginRipple("in")
	}

	function tick(now: number) {
		frame = 0

		if (lastTick) {
			tickTotal += now - lastTick
			tickCount++
		}
		lastTick = now

		// Skip frames that arrive faster than the cap (high refresh rate screens, or the
		// 30fps level). The 0.75 leaves room for timing jitter around the target interval.
		if (now - lastPaint < 750 / limits().fps) {
			frame = requestAnimationFrame(tick)
			return
		}
		lastPaint = now

		if (!paintRipple((now - epoch) / 1000)) {
			frame = requestAnimationFrame(tick)
			return
		}

		// The ripple is done. From here nothing is scheduled per frame until the next one.
		judgePace()
		if (phase === "in") {
			if (isStill()) {
				setPhase("still")
				return
			}

			setPhase("hold")
			wakeAt = epoch + (rippleIn + options.hold) * 1000
		}
		else {
			setPhase("pause")
			wakeAt = epoch + (rippleOut + options.pause) * 1000
		}
		schedule()
	}

	function onVisibilityChange() {
		if (document.hidden) {
			hiddenAt = performance.now()
			unschedule()
			return
		}

		if (restartWhenVisible) {
			restartWhenVisible = false
			hiddenAt = 0
			beginCycle()
			return
		}

		// Carry on exactly where it stopped, as if no time had passed.
		if (hiddenAt) {
			const away = performance.now() - hiddenAt
			epoch += away
			wakeAt += away
			hiddenAt = 0
		}
		lastPaint = 0
		lastTick = 0
		schedule()
	}

	function onResize() {
		resizeTimer = 0
		if (phase === "idle") {
			return
		}

		const spareWidth = builtWidth - container.clientWidth
		const spareHeight = builtHeight - container.clientHeight
		const stillCovered = spareWidth >= 0 && spareWidth <= RESIZE_SLACK && spareHeight >= 0 && spareHeight <= RESIZE_SLACK
		if (!stillCovered) {
			beginCycle()
		}
	}

	function onMotionChange() {
		if (phase !== "idle") {
			beginCycle()
		}
	}

	const observer = new ResizeObserver(() => {
		clearTimeout(resizeTimer)
		resizeTimer = window.setTimeout(onResize, RESIZE_SETTLE_MS)
	})
	observer.observe(container)
	document.addEventListener("visibilitychange", onVisibilityChange)
	motionQuery.addEventListener("change", onMotionChange)

	beginCycle()

	return () => {
		destroyed = true
		unschedule()
		clearTimeout(resizeTimer)
		observer.disconnect()
		document.removeEventListener("visibilitychange", onVisibilityChange)
		motionQuery.removeEventListener("change", onMotionChange)
	}
}
