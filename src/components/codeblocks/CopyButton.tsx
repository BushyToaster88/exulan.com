"use client"

import { Clipboard } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export default function CopyButton(
	{
		getText,
		className,
		disabled = false,
	}: {
		readonly getText: () => string
		readonly className?: string
		readonly disabled?: boolean
	},
) {
	const [copied, setCopied] = useState<null | boolean>(null)
	const timeoutRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (timeoutRef.current != null) {
				window.clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleCopy = async () => {
		if (disabled) {
			return
		}

		try {
			await navigator.clipboard.writeText(getText())
			setCopied(true)
		}
		catch (error) {
			setCopied(false)
			console.log("Failed to write clipboard:", error)
		}

		if (timeoutRef.current != null) {
			window.clearTimeout(timeoutRef.current)
		}

		timeoutRef.current = window.setTimeout(() => setCopied(null), 1500)
	}

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={handleCopy}
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-theme-fg-2",
				"disabled:opacity-50 transition-colors",
				copied === null && "hover:text-theme-fg-0 active:text-theme-fg-1",
				copied === true && "hover:text-theme-g-1 active:text-theme-g-2 text-theme-g-0",
				copied === false && "hover:text-theme-r-1 active:text-theme-r-2 text-theme-r-0",
				className,
			)}
		>
			<Clipboard size={16} aria-hidden="true" />
		</button>
	)
}
