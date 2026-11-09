"use client"

import { useEffect, useRef } from "react"

import { Mosaic } from "@/lib/mosaic"
import { cn } from "@/lib/utils"

// Gay men's pride flag (2019): greens to blues to indigo, white in the middle.
const PRIDE_STOPS = ["#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78"]
	.map(hex => {
		const n = Number.parseInt(hex.slice(1), 16)
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
	})

// Exuael dark background (--core-bg-0).
const BACKGROUND = "#080916"

// Fill opacity of the squares, kept low so page text stays readable.
const SQUARE_ALPHA = 0.28

// Cycle timing, in seconds.
const RIPPLE_IN = 2.6
const HOLD = 9
const RIPPLE_OUT = 2.2
const PAUSE = 0.4

const CELL_SIZE = 9
const GAP = 1

function prideColor(k: number): string {
	// Position along the flag, so small squares are green and large ones indigo.
	const pos = Math.min(1, Math.max(0, k)) * (PRIDE_STOPS.length - 1)
	const i = Math.min(PRIDE_STOPS.length - 2, Math.floor(pos))
	const f = pos - i
	const a = PRIDE_STOPS[i]
	const b = PRIDE_STOPS[i + 1]
	return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)}, ${Math.round(a[1] + (b[1] - a[1]) * f)}, ${Math.round(a[2] + (b[2] - a[2]) * f)})`
}

export function MosaicBackground({ className }: { readonly className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const context = canvas?.getContext("2d")
		if (!canvas || !context) {
			return
		}

		const reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches

		let width = 0
		let height = 0
		let mosaic: Mosaic | null = null
		let colors: string[] = []
		let cycleStart = performance.now()
		let seed = Math.floor(Math.random() * 0xFFFFFF) + 1
		let frame = 0

		function build() {
			mosaic = new Mosaic({ width, height, cellSize: CELL_SIZE, gap: GAP, seed, jitter: 40 })
			colors = mosaic.squares.map(sq => prideColor(sq.k))
		}

		function resize() {
			const dpr = Math.min(globalThis.devicePixelRatio || 1, 2)
			width = Math.max(1, canvas!.clientWidth)
			height = Math.max(1, canvas!.clientHeight)
			canvas!.width = Math.round(width * dpr)
			canvas!.height = Math.round(height * dpr)
			context!.setTransform(dpr, 0, 0, dpr, 0, 0)
			build()
			draw(reduceMotion ? 1e9 : (performance.now() - cycleStart) / 1000)
		}

		function draw(t: number) {
			if (!mosaic) {
				return
			}

			context!.globalAlpha = 1
			context!.fillStyle = BACKGROUND
			context!.fillRect(0, 0, width, height)

			const outStart = RIPPLE_IN + HOLD
			const squares = mosaic.squares
			for (let i = 0; i < squares.length; i++) {
				const sq = squares[i]
				let p = Mosaic.progress(sq, t, 0, RIPPLE_IN)
				if (t >= outStart) {
					p *= 1 - Mosaic.progress(sq, t, outStart, RIPPLE_OUT, true)
				}

				if (p <= 0.001) {
					continue
				}

				const size = sq.s * p
				context!.globalAlpha = SQUARE_ALPHA * p
				context!.fillStyle = colors[i]
				context!.fillRect(sq.cx - size / 2, sq.cy - size / 2, size, size)
			}

			context!.globalAlpha = 1
		}

		function tick(now: number) {
			let t = (now - cycleStart) / 1000
			if (t > RIPPLE_IN + HOLD + RIPPLE_OUT + PAUSE) {
				// Next cycle: fresh seed, fresh epicentre.
				seed = (seed * 1664525 + 1013904223) % 0xFFFFFF + 1
				cycleStart = now
				t = 0
				build()
			}

			draw(t)
			frame = requestAnimationFrame(tick)
		}

		resize()
		const observer = new ResizeObserver(resize)
		observer.observe(canvas)

		if (!reduceMotion) {
			frame = requestAnimationFrame(tick)
		}

		return () => {
			cancelAnimationFrame(frame)
			observer.disconnect()
		}
	}, [])

	return <canvas ref={canvasRef} className={cn("block h-full w-full", className)} aria-hidden="true" />
}
