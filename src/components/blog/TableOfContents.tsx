"use client"

import type { Toc, TocEntry } from "@stefanprobst/rehype-extract-toc"
import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const HEADING_SELECTOR = "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
const ACTIVE_LINE_OFFSET = 96

function TocItem({ entry, activeId, depth = 0 }: { readonly entry: TocEntry; readonly activeId: string | null; readonly depth?: number }) {
	const hasChildren = entry.children && entry.children.length > 0
	const isActive = entry.id != null && entry.id === activeId

	return (
		<li>
			<a
				href={entry.id ? `#${entry.id}` : undefined}
				className={cn(
					"block py-0.5 text-sm transition-colors",
					"border-l-2 border-transparent pl-2",
					isActive && "border-theme-fg-0 text-theme-fg-0 font-base",
					!isActive && "text-theme-fg-2 hover:text-theme-fg-1 hover:border-theme-fg-2",
				)}
				style={{ paddingLeft: `${(depth + 1) * 0.5 + 0.25}rem` }}
			>
				{entry.value}
			</a>
			{hasChildren && (
				<ul className="space-y-0">
					{entry.children.map(child => <TocItem key={child.value + (child.id ?? "")} entry={child} activeId={activeId} depth={depth + 1} />)}
				</ul>
			)}
		</li>
	)
}

function collectHeadingIds(entries: Toc): string[] {
	return entries.flatMap(entry => [
		...(entry.id != null ? [entry.id] : []),
		...(entry.children != null ? collectHeadingIds(entry.children) : []),
	])
}

function findScrollContainer(start: HTMLElement | null): HTMLElement | null {
	let node = start?.parentElement ?? null

	while (node) {
		if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) {
			return node
		}

		node = node.parentElement
	}

	return null
}

export default function TableOfContents({ className, toc }: { readonly className: string; readonly toc: Toc }) {
	const [activeId, setActiveId] = useState<string | null>(null)

	const asideRef = useRef<HTMLElement | null>(null)
	const headingsRef = useRef<HTMLElement[]>([])
	const lastActiveIdRef = useRef<string | null>(null)
	const tickingRef = useRef(false)
	const rafIdRef = useRef(0)

	const tocIds = useMemo(() => new Set(collectHeadingIds(toc)), [toc])

	useEffect(() => {
		const container = findScrollContainer(asideRef.current)

		if (container == null || tocIds.size === 0) {
			return
		}

		headingsRef.current = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(heading => tocIds.has(heading.id))

		const computeActive = () => {
			// The active section is the last heading (in document order) whose top
			// has scrolled past the reading line near the top of the container.
			const activeLine = container.getBoundingClientRect().top + ACTIVE_LINE_OFFSET
			let current: string | null = null

			for (const heading of headingsRef.current) {
				if (heading.getBoundingClientRect().top <= activeLine) {
					current = heading.id
				}
			}

			if (current !== lastActiveIdRef.current) {
				lastActiveIdRef.current = current
				setActiveId(current)
			}
		}

		const scheduleCompute = () => {
			if (tickingRef.current) {
				return
			}

			tickingRef.current = true
			rafIdRef.current = requestAnimationFrame(() => {
				tickingRef.current = false
				computeActive()
			})
		}

		container.addEventListener("scroll", scheduleCompute, { passive: true })
		window.addEventListener("resize", scheduleCompute)

		computeActive()

		return () => {
			container.removeEventListener("scroll", scheduleCompute)
			window.removeEventListener("resize", scheduleCompute)
			cancelAnimationFrame(rafIdRef.current)
			tickingRef.current = false
			headingsRef.current = []
		}
	}, [tocIds])

	if (toc.length === 0) {
		return null
	}

	return (
		<aside ref={asideRef} className={cn("sticky top-24 max-h-screen overflow-y-auto overflow-x-clip", className)}>
			<h2 className="text-base font-semibold text-center tracking-wider text-theme-fg-3 mb-2">
				Table of contents
			</h2>
			<nav>
				<ul className="space-y-0">
					{toc.map(entry => <TocItem key={entry.value + (entry.id ?? "")} entry={entry} activeId={activeId} />)}
				</ul>
			</nav>
		</aside>
	)
}
