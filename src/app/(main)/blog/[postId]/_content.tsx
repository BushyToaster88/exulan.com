"use client"

import type { Toc } from "@stefanprobst/rehype-extract-toc"
import clsx from "clsx"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import Link from "next/link"

import type { BlogMetadata } from "@/lib/blog-post"
import { GRAYSCALE_BACKDROP } from "@/lib/styles"

import { DynamicTimestamp } from "@/components/DynamicTimestamp"
import TableOfContents from "@/components/blog/TableOfContents"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

dayjs.extend(relativeTime)

export default function BlogPostContent(
	{
		children,
		metadata,
		toc,
	}: {
		readonly children: React.ReactNode
		readonly metadata: BlogMetadata
		readonly toc: Toc
	},
) {
	const {
		date: postDateString,
		tags: postTags,
		title: postTitle,
		desc: postDesc,
	} = metadata

	return (
		<article className={clsx(GRAYSCALE_BACKDROP, "container mx-auto h-full px-4 py-8 max-w-6xl")}>
			<Link
				href="/blog"
				className={cn(
					"inline-block mb-6 px-3 py-2 bg-theme-bg-0 rounded-lg text-theme-fg-2 hover:text-theme-fg-0 text-sm",
					"border border-theme-fg-3 hover:border-theme-fg-1 transition-colors",
				)}
			>
				⇚ Back to blog
			</Link>

			<div className="grid grid-cols-5 gap-2">
				<div className="col-span-4">
					<header className="mb-4 border-b pb-4">
						<h1 className="text-3xl font-bold mb-2">{postTitle}</h1>
						<p className="text-sm text-theme-fg-1 mb-2">{postDesc}</p>

						<DynamicTimestamp dateString={postDateString} className="text-sm text-theme-fg-2" />

						{postTags.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-3">
								{postTags.map(tag => <Badge variant="secondary" key={tag}>{tag}</Badge>)}
							</div>
						)}
					</header>

					<div className="prose prose-invert max-w-none">
						{children}
					</div>
				</div>

				<TableOfContents className="col-span-1" toc={toc} />
			</div>
		</article>
	)
}
