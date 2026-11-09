import type { Toc } from "@stefanprobst/rehype-extract-toc"

import { BlogMetadata } from "./lib/blog-post"

declare module "*.mdx" {
	const MDXComponent: () => JSX.Element

	export default MDXComponent
	export const frontmatter: BlogMetadata
	export const tableOfContents: Toc
}
