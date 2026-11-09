import type { ComponentType } from "react"

import { BlogMetadata, BlogPost } from "@/lib/blog-post"
import dayjs from "dayjs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdxContext = (require as any).context("./", false, /\.mdx?$/)

const postsMap: Record<string, BlogPost> = {}

for (const key of mdxContext.keys()) {
	const val = mdxContext(key)
	const postId = (val.frontmatter as BlogMetadata).id

	postsMap[postId] = {
		Component: val.default as ComponentType,
		metadata: val.frontmatter,
		tableOfContents: val.tableOfContents ?? [],
		id: postId,
	}
}

export const POST_LIST: BlogPost[] = Object.values(postsMap).sort(
	(a, b) => dayjs(a.metadata.date).isBefore(b.metadata.date) ? -1 : 1,
)
export const POST_ID_LIST = Object.keys(postsMap)

export function getPost(postId: string): BlogPost | undefined {
	return postsMap[postId]
}
