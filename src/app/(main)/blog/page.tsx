import type { Metadata } from "next"

import { POST_LIST } from "@/blog-posts"
import { BLOG_DESCRIPTION, SITE_LANGUAGE, SITE_NAME, WEBSITE_AUTHOR, WEBSITE_URL } from "@/constants"
import { serializeJsonLd } from "@/lib/seo"
import BlogListContent from "./_content"

export const metadata: Metadata = {
	title: "Blog",
	description: BLOG_DESCRIPTION,
	alternates: { canonical: "/blog" },
}

export default function BlogList() {
	const blogUrl = `${WEBSITE_URL}/blog`
	const blogJsonLd = {
		"@context": "https://schema.org",
		"@type": "Blog",
		"@id": `${blogUrl}#blog`,
		"url": blogUrl,
		"name": `${SITE_NAME} blog`,
		"description": BLOG_DESCRIPTION,
		"inLanguage": SITE_LANGUAGE,
		"publisher": { "@type": "Person", ...WEBSITE_AUTHOR },
		"blogPost": POST_LIST.map(({ id, metadata }) => ({
			"@type": "BlogPosting",
			"headline": metadata.title,
			"description": metadata.metaDesc ?? metadata.desc,
			"url": `${blogUrl}/${id}`,
			"datePublished": metadata.date,
			"dateModified": metadata.edit || metadata.date,
		})),
	}

	return (
		<>
			<BlogListContent />
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd) }}
			/>
		</>
	)
}
