import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPost, POST_ID_LIST } from "@/blog-posts"

import { WEBSITE_AUTHOR, WEBSITE_URL } from "@/constants"
import { checkMetadata } from "@/lib/blog-post"
import BlogPostContent from "./_content"

export function generateStaticParams() {
	return POST_ID_LIST.map(postId => ({ postId }))
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
			tags: postTags,
			title: postTitle,
			thumbnail: postThumbnail,
		},
	} = post

	return {
		title: postTitle,
		description: postDesc,
		alternates: { canonical: `/blog/${postId}` },
		authors: [WEBSITE_AUTHOR],
		openGraph: {
			type: "article",
			url: `/blog/${postId}`,
			publishedTime: postDate,
			modifiedTime: postEditDate || postDate,
			authors: [WEBSITE_AUTHOR.url],
			tags: postTags,
			...(postThumbnail
				? {
					images: {
						url: `/assets/blogs/${postId}/${postThumbnail}`,
						alt: postTitle,
					},
				}
				: {}),
		},
		twitter: {
			card: postThumbnail ? "summary_large_image" : "summary",
			title: postTitle,
			description: postDesc,
			...(postThumbnail
				? {
					images: {
						url: `/assets/blogs/${postId}/${postThumbnail}`,
						alt: postTitle,
					},
				}
				: {}),
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
		tags: postTags,
		title: postTitle,
		thumbnail: postThumbnail,
	} = metadata

	const postUrl = `${WEBSITE_URL}/blog/${postId}`
	const articleJsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"headline": postTitle,
		"description": postDesc,
		"image": postThumbnail ? `${WEBSITE_URL}/assets/blogs/${postId}/${postThumbnail}` : undefined,
		"datePublished": postDate,
		"dateModified": postEditDate || postDate,
		"author": { "@type": "Person", ...WEBSITE_AUTHOR },
		"publisher": { "@type": "Person", ...WEBSITE_AUTHOR },
		"mainEntityOfPage": { "@type": "WebPage", "@id": postUrl },
		"url": postUrl,
	}

	if (postTags.length > 0) {
		articleJsonLd.keywords = postTags.join(", ")
	}

	return (
		<>
			<BlogPostContent metadata={metadata} toc={tableOfContents}>
				<Component />
			</BlogPostContent>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
			/>
		</>
	)
}
