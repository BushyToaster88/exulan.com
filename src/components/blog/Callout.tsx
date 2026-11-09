import { AlertCircle, BookMarked, CircleAlert, Info, Lightbulb, type LucideProps, MessageSquareWarning, OctagonAlert, TriangleAlert } from "lucide-react"
import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

export type CalloutType = "note" | "tip" | "important" | "warning" | "caution"

type CalloutDescriptor = {
	iconType: ComponentType<LucideProps>
	iconTitle: string
	iconColor: string
	iconBorder: string
}

const CALLOUT_STYLES: Record<CalloutType, CalloutDescriptor> = {
	note: {
		iconType: BookMarked,
		iconTitle: "Note",
		iconColor: "text-theme-c-1",
		iconBorder: "border-theme-c-1",
	},
	tip: {
		iconType: Lightbulb,
		iconTitle: "Tip",
		iconColor: "text-theme-g-1",
		iconBorder: "border-theme-g-1",
	},
	important: {
		iconType: MessageSquareWarning,
		iconTitle: "Important",
		iconColor: "text-theme-m-1",
		iconBorder: "border-theme-m-1",
	},
	warning: {
		iconType: TriangleAlert,
		iconTitle: "Warning",
		iconColor: "text-theme-y-1",
		iconBorder: "border-theme-y-1",
	},
	caution: {
		iconType: OctagonAlert,
		iconTitle: "Caution",
		iconColor: "text-theme-r-1",
		iconBorder: "border-theme-r-1",
	},
}

export function Callout({
	type = "note",
	className,
	children,
}: {
	readonly type?: string
	readonly className?: string
	readonly children?: ReactNode
}) {
	const calloutStyle = CALLOUT_STYLES[type.toLowerCase() as CalloutType]

	const {
		iconType: Icon,
		iconTitle,
		iconColor,
		iconBorder,
	} = calloutStyle

	return (
		<div
			className={cn(
				"my-2 flex flex-col items-start border-l-3 py-0 pl-3",
				className,
				iconBorder,
			)}
		>
			<p className={cn(iconColor, "flex text-base items-center mb-1")}>
				<Icon aria-hidden="true" className={cn("mr-2 h-4 w-4 shrink-0", iconColor)} />
				{iconTitle}
			</p>

			<div className="min-w-0 flex-1">{children}</div>
		</div>
	)
}
