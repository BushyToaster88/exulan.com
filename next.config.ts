import createMDX from "@next/mdx"
import type { NextConfig } from "next"
import path from "node:path"

import rehypeShiki from "@shikijs/rehype"
import withToc from "@stefanprobst/rehype-extract-toc"
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx"
import type { Element, Root } from "hast"
import { isElement } from "hast-util-is-element"
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx"
import rehypeKatex from "rehype-katex"
import rehypeMdxCodeProps from "rehype-mdx-code-props"
import rehypeSlug from "rehype-slug"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import type { ShikiTransformer } from "shiki"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"

/**
 * Assets folder of the post currently being compiled, derived from its file name.
 * Falls back to the frontmatter `id` (set by remark-mdx-frontmatter).
 */
function postAssetsBase(file: VFile): string | null {
	const fileName = path.basename(file.path ?? "")
	const stem = fileName.replace(/\.mdx?$/i, "")

	if (stem && stem !== fileName) {
		return stem
	}

	const id = (file.data.matter as { id?: unknown } | undefined)?.id

	return typeof id === "string" && id.trim() ? id.trim() : null
}

function rewriteAssetSource(src: string | undefined, base: string): string {
	if (!src) {
		return src
	}

	let url = src.trim()

	if (
		!url
		|| /^(?:(data:)|\/|#)/.test(url)
		|| /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
	) {
		return src
	}

	if (url.startsWith("./")) {
		url = url.slice(2)
	}

	return `/assets/blogs/${base}/${url}`
}

/**
 * Rewrite relative asset sources in a blog post to
 * `/assets/blogs/<postId>/<fileName>` so posts can use `![alt](asset.png)`.
 */
function rehypeBlogAssets() {
	return (tree: Root, file: VFile): void => {
		const base = postAssetsBase(file)

		if (!base) {
			return
		}

		visit(tree, node => {
			if (node.type === "mdxJsxFlowElement") {
				const jsxElement = node as MdxJsxFlowElement

				// `<img src>` takes a relative asset path.
				if (jsxElement.name !== "img") {
					return
				}
				if (!jsxElement.attributes) {
					return
				}

				for (const attribute of jsxElement.attributes) {
					if (attribute.type === "mdxJsxAttribute" && attribute.name === "src" && typeof attribute.value === "string") {
						attribute.value = rewriteAssetSource(attribute.value, base)
					}
				}

				return
			}

			if (!isElement(node)) {
				return
			}

			if (node.tagName === "img") {
				node.properties.src = rewriteAssetSource(node.properties.src, base)
			}
			else if (node.tagName === "a") {
				node.properties.href = rewriteAssetSource(node.properties.href, base)
			}
		})
	}
}

const CALLOUT_TYPES = new Set(["note", "tip", "important", "warning", "caution"])
const CALLOUT_MARKER_RE = /^\s*\[!(note|tip|important|warning|caution)\]\s*/i

/**
 * Turns GitHub-style `> [!NOTE]` blockquotes into `<Callout type="note">` elements.
 * Which get rendered by the `Callout` component registered in `src/mdx-components.tsx`.
 */
function rehypeCallouts() {
	return (tree: Root): void => {
		// Collect first, transform after: `visit` doesn't like the tree being
		// restructured while it is still walking it.
		const blockquotes: Element[] = []

		visit(tree, node => {
			if (isElement(node) && node.tagName === "blockquote") {
				blockquotes.push(node)
			}
		})

		for (const blockquote of blockquotes) {
			// MDX inserts whitespace text between blockquote children; the marker
			// lives at the start of the first paragraph's first text node, which
			// usually also contains the rest of the callout content after `\n`.
			const markerParagraph = blockquote.children.find(
				(child): child is Element => isElement(child) && child.tagName === "p",
			)

			if (!markerParagraph) {
				continue
			}

			const markerText = markerParagraph.children[0]
			if (markerText?.type !== "text") {
				continue
			}

			const match = CALLOUT_MARKER_RE.exec(markerText.value)
			if (!match) {
				continue
			}

			const type = match[1].toLowerCase()
			if (!CALLOUT_TYPES.has(type)) {
				continue
			}

			// Remove the `[!TYPE]` marker (and the newline after it) from the
			// first text node; drop the paragraph only if it held just the marker.
			const rest = markerText.value.slice(match[0].length)
			if (rest.trim() === "") {
				blockquote.children = blockquote.children.filter(child => child !== markerParagraph)
			}
			else {
				markerText.value = rest
			}

			// `Callout` is resolved through the MDX components map at render time.
			blockquote.tagName = "Callout"
			blockquote.properties = { ...blockquote.properties, type }
		}
	}
}

/**
 * `@shikijs/rehype` rebuilds fenced code blocks from its own fragment and drops
 * the mdast `code.data.meta` string that `rehypeMdxCodeProps` reads. Re-attach
 * the raw meta from the transformer context so props written on the fence info
 * string (e.g. ` ```py filename="example.py" `) survive until that plugin runs.
 */
const preserveCodeMetaTransformer: ShikiTransformer = {
	name: "preserve-code-meta",
	code(node) {
		const raw = this.options.meta?.__raw

		if (raw && !node.data?.meta) {
			node.data = { ...node.data, meta: raw }
		}

		return node
	},
}

const withMDX = createMDX({
	extension: /\.mdx?$/,
	options: {
		// `.md` files are plain Markdown (no JSX or expressions), `.mdx` files are MDX.
		format: "detect",
		remarkPlugins: [
			remarkFrontmatter,
			remarkMdxFrontmatter,
			remarkGfm,
			remarkMath,
		],
		rehypePlugins: [
			rehypeSlug,
			rehypeKatex,
			[rehypeShiki, { theme: "dark-plus", addLanguageClass: true, transformers: [preserveCodeMetaTransformer] }],
			rehypeCallouts,
			rehypeBlogAssets,
			withToc,
			withTocExport,
			// Turns fenced code meta into `<pre>` props, so `filename` etc.
			// reach the mapped `CodeBlock` component. Converts hast into JSX nodes.
			// Must run last.
			rehypeMdxCodeProps,
		],
	},
})

const nextConfig: NextConfig = {
	output: "export",
	agentRules: false,
	distDir: "dist",

	pageExtensions: ["ts", "tsx", "md", "mdx"],
}

export default withMDX(nextConfig)
