import type { MetadataRoute } from "next"

import { getPost, POST_ID_LIST } from "@/blog-posts"
import { WEBSITE_URL } from "@/constants"

// sitemap.ts compiles to a special route handler; under `output: "export"`
// Next.js requires an explicit static-generation marker on the route.
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
	const entries: MetadataRoute.Sitemap = [
		{ url: WEBSITE_URL, changeFrequency: "weekly", priority: 1 },
		{ url: `${WEBSITE_URL}/blog`, changeFrequency: "weekly", priority: 0.9 },
		{ url: `${WEBSITE_URL}/background`, changeFrequency: "monthly", priority: 0.5 },
	]

	for (const postId of POST_ID_LIST) {
		const post = getPost(postId)

		entries.push({
			url: `${WEBSITE_URL}/blog/${postId}`,
			lastModified: post?.metadata.edit || post?.metadata.date,
			changeFrequency: "monthly",
			priority: 0.8,
		})
	}

	return entries
}
