import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPost, POST_ID_LIST } from "@/blog-posts"

import { DEFAULT_OG_IMAGE, SITE_LANGUAGE, SITE_LOCALE, SITE_NAME, WEBSITE_AUTHOR, WEBSITE_URL } from "@/constants"
import { checkMetadata } from "@/lib/blog-post"
import { absoluteUrl, serializeJsonLd } from "@/lib/seo"
import BlogPostContent from "./_content"

export function generateStaticParams() {
	return POST_ID_LIST.map(postId => ({ postId }))
}

/** Preview image for a post: its own thumbnail if it has one, otherwise the site card. */
function postImage(postId: string, thumbnail: string | undefined, title: string) {
	return thumbnail
		? { url: `/assets/blogs/${postId}/${thumbnail}`, alt: title }
		: DEFAULT_OG_IMAGE
}

export async function generateMetadata({ params }: { readonly params: Promise<{ postId: string }> }): Promise<Metadata> {
	const { postId } = await params
	const post = getPost(postId)

	if (!post) {
		return {}
	}

	const {
		metadata: {
			date: postDate,
			edit: postEditDate,
			desc: postDesc,
			metaDesc: postMetaDesc,
			tags: postTags,
			title: postTitle,
			thumbnail: postThumbnail,
		},
	} = post

	const description = postMetaDesc ?? postDesc
	const image = postImage(postId, postThumbnail, postTitle)

	return {
		title: postTitle,
		description,
		keywords: postTags,
		alternates: { canonical: `/blog/${postId}` },
		authors: [WEBSITE_AUTHOR],
		openGraph: {
			type: "article",
			url: `/blog/${postId}`,
			title: postTitle,
			description,
			siteName: SITE_NAME,
			locale: SITE_LOCALE,
			publishedTime: postDate,
			modifiedTime: postEditDate || postDate,
			authors: [WEBSITE_AUTHOR.url],
			tags: postTags,
			images: [image],
		},
		twitter: {
			card: "summary_large_image",
			title: postTitle,
			description,
			images: [{ url: image.url, alt: image.alt }],
		},
	}
}

export default async function BlogPost(
	{
		params,
	}: {
		readonly params: Promise<{ postId: string }>
	},
) {
	const { postId } = await params
	const post = getPost(postId)

	if (!post) {
		notFound()
	}

	checkMetadata(post.metadata)

	const { Component, metadata, tableOfContents } = post
	const {
		date: postDate,
		edit: postEditDate,
		desc: postDesc,
		metaDesc: postMetaDesc,
		tags: postTags,
		title: postTitle,
		thumbnail: postThumbnail,
	} = metadata

	const postUrl = `${WEBSITE_URL}/blog/${postId}`
	const blogUrl = `${WEBSITE_URL}/blog`
	const author = { "@type": "Person", ...WEBSITE_AUTHOR }

	const structuredData = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "BlogPosting",
				"@id": `${postUrl}#article`,
				"headline": postTitle,
				"description": postMetaDesc ?? postDesc,
				"image": [absoluteUrl(postImage(postId, postThumbnail, postTitle).url)],
				"datePublished": postDate,
				"dateModified": postEditDate || postDate,
				"inLanguage": SITE_LANGUAGE,
				"author": author,
				"publisher": author,
				"mainEntityOfPage": { "@type": "WebPage", "@id": postUrl },
				"url": postUrl,
				"isPartOf": { "@type": "Blog", "@id": `${blogUrl}#blog`, "name": `${SITE_NAME} blog`, "url": blogUrl },
				...(postTags.length > 0 ? { keywords: postTags.join(", ") } : {}),
			},
			{
				"@type": "BreadcrumbList",
				"itemListElement": [
					{ "@type": "ListItem", "position": 1, "name": "Home", "item": WEBSITE_URL },
					{ "@type": "ListItem", "position": 2, "name": "Blog", "item": blogUrl },
					{ "@type": "ListItem", "position": 3, "name": postTitle, "item": postUrl },
				],
			},
		],
	}

	return (
		<>
			<BlogPostContent metadata={metadata} toc={tableOfContents}>
				<Component />
			</BlogPostContent>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
			/>
		</>
	)
}
