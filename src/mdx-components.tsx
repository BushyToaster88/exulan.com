import type { MDXComponents } from "mdx/types"
import type { HTMLAttributes, ImgHTMLAttributes } from "react"

import { Callout } from "@/components/blog/Callout"
import CodeBlock from "@/components/blog/CodeBlock"
import { cn } from "./lib/utils"

const HEADER_STYLING = "mt-3 first:mt-0 mb-2 font-semibold tracking-tight"
const BLOCKQUOTE_STYLING = "border-l-2 mt-2 border-fg-3 pl-6 italic text-fg-2 [&>*]:text-fg-3"


export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		h1: ({ className, children, ...props }) => <h1 className={cn(HEADER_STYLING, "text-4xl", className)} {...props}>{children}</h1>,
		h2: ({ className, children, ...props }) => <h2 className={cn(HEADER_STYLING, "text-3xl", className)} {...props}>{children}</h2>,
		h3: ({ className, children, ...props }) => <h3 className={cn(HEADER_STYLING, "text-2xl", className)} {...props}>{children}</h3>,
		h4: ({ className, children, ...props }) => <h4 className={cn(HEADER_STYLING, "text-xl", className)} {...props}>{children}</h4>,
		h5: ({ className, children, ...props }) => <h5 className={cn(HEADER_STYLING, "text-lg", className)} {...props}>{children}</h5>,
		h6: ({ className, children, ...props }) => <h6 className={cn(HEADER_STYLING, "text-base", className)} {...props}>{children}</h6>,

		a: ({ className, ...props }) => <a className={cn("font-medium text-theme-fg-1 underline", className)} {...props} />,
		p: ({ className, ...props }) => <p className={cn("leading-6 pb-2 text-sm/5", className)} {...props} />,

		ul: ({ className, ...props }) => <ul className={cn("my-0 pl-4 pb-2 list-disc", className)} {...props} />,
		ol: ({ className, ...props }) => <ol className={cn("my-0 pl-4 pb-2 list-decimal", className)} {...props} />,
		li: ({ className, ...props }) => <li className={cn("my-0 ml-3 text-sm/5", className)} {...props} />,

		blockquote: ({ className, ...props }) => <blockquote className={cn(BLOCKQUOTE_STYLING, className)} {...props} />,

		img: ({ className, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => (
			<img
				// Never block first paint/hydration on image decode.
				// Instead, mark all decode work async and only fetch images once they scroll near the viewport.
				// Per-image attributes (e.g. an explicit `loading="eager"` in MDX) win because they spread last.
				loading="lazy"
				decoding="async"
				className={cn("rounded-md border border-theme-bg-2 my-1", className)}
				alt={alt}
				{...props}
			/>
		),

		hr: ({ className, ...props }) => <hr className={cn("my-4 border md:my-8", className)} {...props} />,

		table: ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
			<div className="my-2 w-full overflow-x-auto rounded-md border">
				<table className={cn("w-full border-separate border-spacing-0 text-sm", className)} {...props} />
			</div>
		),
		tr: ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
			<tr
				className={cn("m-0 border-t p-0 even:bg-theme-bg-0 odd:bg-theme-bg-1", className)}
				{...props}
			/>
		),
		th: ({ className, ...props }) => (
			<th
				className={cn(
					"border-b border-r px-2.5 py-1 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right last:border-r-0 [tbody_tr:last-child_&]:border-b-0",
					className,
				)}
				{...props}
			/>
		),
		td: ({ className, ...props }) => (
			<td
				className={cn(
					"border-b border-r px-2.5 py-1 text-left [&[align=center]]:text-center [&[align=right]]:text-right last:border-r-0 [tbody_tr:last-child_&]:border-b-0",
					className,
				)}
				{...props}
			/>
		),

		pre: props => <CodeBlock {...props} />,
		code: ({ className, ...props }) => (
			<code
				className={cn(
					"relative rounded-md border px-1 py-auto font-mono text-sm text-center",
					className,
				)}
				{...props}
			/>
		),

		// General
		Callout,

		...components,
	}
}
