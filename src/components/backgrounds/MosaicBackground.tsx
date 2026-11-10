"use client"

import { useEffect, useRef } from "react"

import { createMosaicRenderer } from "@/lib/mosaic-renderer"
import { cn } from "@/lib/utils"

// Gay men's pride flag (2019): greens to blues to indigo, white in the middle.
const PRIDE_STOPS = ["#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78"]
	.map(hex => {
		const n = Number.parseInt(hex.slice(1), 16)
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
	})

// Exuael dark background (--core-bg-0).
const BACKGROUND = "#080916"

function prideColor(k: number): string {
	// Position along the flag, so small squares are green and large ones indigo.
	const pos = Math.min(1, Math.max(0, k)) * (PRIDE_STOPS.length - 1)
	const i = Math.min(PRIDE_STOPS.length - 2, Math.floor(pos))
	const f = pos - i
	const a = PRIDE_STOPS[i]
	const b = PRIDE_STOPS[i + 1]
	return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)}, ${Math.round(a[1] + (b[1] - a[1]) * f)}, ${Math.round(a[2] + (b[2] - a[2]) * f)})`
}

/**
 * The tiling mosaic background. `className` positions and sizes the area it covers
 * (for example `fixed inset-0`); the canvas inside is sized by the renderer.
 */
export function MosaicBackground({ className }: { readonly className?: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const container = containerRef.current
		const canvas = canvasRef.current
		if (!container || !canvas) {
			return
		}

		return createMosaicRenderer(canvas, container, {
			background: BACKGROUND,
			// Kept low so page text stays readable.
			squareAlpha: 0.28,
			colorFor: prideColor,
			cellSize: 9,
			gap: 1,
			jitter: 40,
			rippleIn: 2.6,
			hold: 9,
			rippleOut: 2.2,
			pause: 0.4,
		})
	}, [])

	return (
		<div
			ref={containerRef}
			className={cn("overflow-hidden", className)}
			style={{ backgroundColor: BACKGROUND }}
			aria-hidden="true"
		>
			<canvas ref={canvasRef} className="absolute left-0 top-0 block" />
		</div>
	)
}
