"use client"

import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useLayoutEffect, useState } from "react"

dayjs.extend(relativeTime)

export function DynamicTimestamp(
	{
		dateString,
		className,
	}: {
		readonly dateString: string
		readonly className?: string
	},
) {
	const date = dayjs(dateString)
	const [relative, setRelative] = useState("...")

	useLayoutEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setRelative(date.fromNow())
	}, [date])

	return (
		<time
			className={className}
			dateTime={date.toISOString()}
			suppressHydrationWarning
		>
			{date.format("YYYY-MM-DD HH:mm")} ({relative ?? "..."})
		</time>
	)
}
