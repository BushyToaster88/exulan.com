"use client"

import { Download, FileCode } from "lucide-react"
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react"
import { useRef } from "react"

import { CodeFrame, CodeSource } from "../codeblocks/CodeContainers"
import CopyButton from "../codeblocks/CopyButton"
import { extractLanguageClass, languageDisplayName } from "../codeblocks/codeLanguage"

function findFenceLanguage(children: ReactNode): string | null {
	if (children == null) {
		return null
	}

	const element = children as ReactElement

	if (element.props != null) {
		return extractLanguageClass((element.props as { className?: unknown }).className)
	}

	return null
}

function downloadFileName(filename: string): string {
	const lastSlash = filename.lastIndexOf("/")
	return lastSlash >= 0 ? filename.slice(lastSlash + 1) : filename
}

export default function CodeBlock({ children, className, style, filename, ...props }: Readonly<HTMLAttributes<HTMLPreElement> & { filename?: string }>) {
	const preRef = useRef<HTMLPreElement | null>(null)
	const language = findFenceLanguage(children)

	const backgroundColor = (style as CSSProperties | undefined)?.backgroundColor

	const copyCode = () => preRef.current?.querySelector("code")?.innerText.trimEnd() ?? ""

	const downloadCode = () => {
		const code = preRef.current?.querySelector("code")
		const fileName = filename && downloadFileName(filename)

		if (!code || !fileName) {
			return
		}

		const blob = new Blob([code.innerText.trimEnd() + "\n"], { type: "text/plain;charset=utf-8" })
		const url = URL.createObjectURL(blob)

		const link = document.createElement("a")
		link.href = url
		link.download = fileName
		link.click()

		URL.revokeObjectURL(url)
	}

	const showFileName = filename != null && filename !== ""

	return (
		<CodeFrame
			backgroundColor={backgroundColor}
			title={(showFileName || language != null) && (
				<div className="flex min-w-0 items-center gap-4">
					{showFileName && (
						<span className="flex min-w-0 items-center gap-1.5 text-xs text-theme-fg-1">
							<FileCode size={14} className="shrink-0" aria-hidden="true" />
							<span className="truncate font-mono">{filename}</span>
						</span>
					)}
					{language != null && (
						<span className="ml-auto block min-w-0 truncate text-base font-medium text-xs tracking-wider text-theme-fg-2">
							{languageDisplayName(language)}
						</span>
					)}
				</div>
			)}
			actions={
				<>
					{showFileName && (
						<button
							type="button"
							onClick={downloadCode}
							title={`Download ${filename}`}
							aria-label={`Download ${filename}`}
							className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-theme-fg-2 transition-colors hover:text-theme-fg-0 active:text-theme-fg-1"
						>
							<Download size={16} aria-hidden="true" />
						</button>
					)}
					<CopyButton getText={copyCode} />
				</>
			}
		>
			<CodeSource reference={preRef} className={className} style={style} {...props}>
				{children}
			</CodeSource>
		</CodeFrame>
	)
}
