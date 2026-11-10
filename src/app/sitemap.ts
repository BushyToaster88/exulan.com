import type { MetadataRoute } from "next"

import { POST_LIST } from "@/blog-posts"
import { DEFAULT_OG_IMAGE, WEBSITE_URL } from "@/constants"
import { absoluteUrl } from "@/lib/seo"

// sitemap.ts compiles to a special route handler; under `output: "export"`
// Next.js requires an explicit static-generation marker on the route.
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
	const modified = POST_LIST.map(({ metadata }) => new Date(metadata.edit || metadata.date))
	// The index pages change whenever a post is added or edited, so they take the newest date.
	// Dates come from the posts themselves rather than the build time, so an unchanged page
	// is never reported as changed. /background is left out on purpose: it is noindex.
	const newest = modified.length > 0 ? new Date(Math.max(...modified.map(date => date.getTime()))) : undefined

	const entries: MetadataRoute.Sitemap = [
		{ url: WEBSITE_URL, lastModified: newest, changeFrequency: "weekly", priority: 1 },
		{ url: `${WEBSITE_URL}/blog`, lastModified: newest, changeFrequency: "weekly", priority: 0.9 },
	]

	POST_LIST.forEach(({ id, metadata }, index) => {
		entries.push({
			url: `${WEBSITE_URL}/blog/${id}`,
			lastModified: modified[index],
			changeFrequency: "monthly",
			priority: 0.8,
			images: [absoluteUrl(metadata.thumbnail ? `/assets/blogs/${id}/${metadata.thumbnail}` : DEFAULT_OG_IMAGE.url)],
		})
	})

	return entries
}
