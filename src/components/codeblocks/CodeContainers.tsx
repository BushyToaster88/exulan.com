import type { CSSProperties, ReactNode, Ref } from "react"

import { cn } from "@/lib/utils"

const CONTAINER_PADDING = "px-2 py-1"

export function CodeFrame(
	{
		title,
		actions,
		backgroundColor,
		className,
		children,
	}: {
		readonly title?: ReactNode
		readonly actions?: ReactNode
		readonly backgroundColor?: string
		readonly className?: string
		readonly children: ReactNode
	},
) {
	const headerStyle: CSSProperties | undefined = backgroundColor ? { backgroundColor } : undefined

	return (
		<div
			className={cn("my-2 overflow-hidden rounded-md border border-theme-bg-2 bg-theme-bg-0", className)}
			style={backgroundColor ? { backgroundColor } : undefined}
		>
			<div
				className={cn(CONTAINER_PADDING, "flex items-center gap-2 border-b border-theme-bg-2")}
				style={headerStyle}
			>
				<div className="min-w-0 flex-1">{title}</div>
				{actions != null && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
			</div>
			{children}
		</div>
	)
}

export function CodeSource(
	{
		reference,
		className,
		style,
		children,
		...props
	}: {
		readonly reference?: Ref<HTMLPreElement>
		readonly className?: string
		readonly children?: ReactNode
		readonly style?: CSSProperties
	},
) {
	return (
		<pre
			ref={reference}
			className={cn(
				CONTAINER_PADDING,
				"m-0 overflow-x-auto bg-transparent font-mono text-sm leading-6 text-theme-fg-1",
				"[&>code]:rounded-none [&>code]:border-none [&>code]:bg-transparent [&>code]:px-0 [&>code]:py-0 [&>code]:text-left",
				className,
			)}
			style={style}
			{...props}
		>
				{children}
		</pre>
	)
}
