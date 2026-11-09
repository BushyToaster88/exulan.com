import type { Toc } from "@stefanprobst/rehype-extract-toc"
import type { ComponentType } from "react"

export type BlogMetadata = {
	thumbnail?: string
	title: string
	desc: string
	date: string
	edit: string
	tags: string[]
	id: string
}

export function checkMetadata(metadata: BlogMetadata) {
	// @todo Maybe use zod going forward
	for (const key of ["title", "desc", "date", "tags", "id"] satisfies (keyof BlogMetadata)[]) {
		if (!metadata[key]) {
			throw new Error(`Invalid metadata for post id ${metadata.id} titled ${metadata.title}`)
		}
	}
}

export type BlogPost = {
	Component: ComponentType
	metadata: BlogMetadata
	tableOfContents: Toc
	id: string
}
