import clsx from "clsx"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import Link from "next/link"

import { POST_LIST } from "@/blog-posts"
import { BlogPost } from "@/lib/blog-post"

import { DynamicTimestamp } from "@/components/DynamicTimestamp"
import { Badge } from "@/components/ui/badge"
import { GRAYSCALE_BACKDROP } from "@/lib/styles"

dayjs.extend(relativeTime)

function getPostDate(post: BlogPost) {
	return dayjs(post.metadata.date)
}

function BlogListEntry({ post }: { readonly post: BlogPost }) {
	const thumbnail = post.metadata.thumbnail

	return (
		<Link
			key={post.id}
			href={`/blog/${post.id}`}
			className={clsx(GRAYSCALE_BACKDROP, "h-50 group flex items-center gap-4 border border-theme-fg-3 rounded-lg p-3 hover:border-theme-fg-1 transition-colors")}
		>
			<div className="min-w-0 flex-1 h-full">
				<h2 className="text-xl font-semibold group-hover:text-theme-fg-0 transition-colors">
					{post.metadata.title}
				</h2>

				<DynamicTimestamp dateString={post.metadata.date} className="text-sm text-theme-fg-2 mt-1 block" />

				<p className="mt-2 text-theme-fg-1 text-sm leading-relaxed">
					{post.metadata.desc}
				</p>

				{post.metadata.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5 mt-3">
						{post.metadata.tags.toSorted((a, b) => a.localeCompare(b)).map(tag => <Badge variant="secondary" key={tag}>{tag}</Badge>)}
					</div>
				)}
			</div>

			{thumbnail != null && (
				<img
					src={`/assets/blogs/${post.id}/${thumbnail}`}
					alt={`${post.metadata.title} thumbnail`}
					className="h-full shrink-0 rounded-md border border-theme-bg-2 object-cover"
					loading="eager"
					decoding="sync"
				/>
			)}
		</Link>
	)
}

export default function BlogListContent() {
	return (
		<div className="container mx-auto px-4 py-8 max-w-3xl">
			<h1 className="text-4xl mb-8">Blog</h1>

			{POST_LIST.length === 0
				? <p className="text-theme-fg-2">No posts yet. Check back soon!</p>
				: (
					<div className="grid gap-6">
						{POST_LIST.toSorted((a, b) => getPostDate(b).diff(getPostDate(a))).map(post => <BlogListEntry post={post} key={post.id} />)}
					</div>
				)}
		</div>
	)
}
