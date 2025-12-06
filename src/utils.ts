import { App, Editor, MarkdownView, TFile } from "obsidian"

const INVALID_CHARS_REGEX = /[\\:*?"<>|]/gu

const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"jfif",
	"pjpeg",
	"pjp",
	"png",
	"gif",
	"webp",
	"png",
	"bmp",
	"ico",
	"cur",
	"avif",
	"heif",
	"heic",
])

export function isImageExt(input: string): boolean {
	return IMAGE_EXTENSIONS.has(input.toLowerCase())
}

function uuidFallback(): string {
	let d = new Date().getTime()
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		d += performance.now() // more uniqueness
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (d + Math.random() * 16) % 16 | 0
		d = Math.floor(d / 16)
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
	})
}

export function generateUUID(): string {
	try {
		return crypto.randomUUID()
	} catch {
		console.warn("could not use crypto module to generate UUID, using fallback")
		return uuidFallback()
	}
}

export function getActiveEditor(app: App): Editor | null {
	return app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null
}

export function replaceCurrLineInEditor(editor: Editor, oldStr: string, newStr: string) {
	const cursor = editor.getCursor()
	const line = editor.getLine(cursor.line)
	const replacedLine = line.replace(oldStr, newStr)

	if (line === replacedLine) {
		return
	}

	editor.transaction({
		changes: [
			{
				from: { ...cursor, ch: 0 },
				to: { ...cursor, ch: line.length },
				text: replacedLine,
			},
		],
	})
}

export function splitLast(value: string, separator: string): [string, string | undefined] {
	if (!separator) {
		return [value, undefined]
	}

	const idx = value.lastIndexOf(separator) ?? -1

	if (idx < 0) {
		return [value, undefined]
	}

	return [value.slice(0, idx), value.slice(idx + separator.length)]
}

export function isValidInput(input: string): boolean {
	return !(input === "" || input.endsWith("/") || input.match(INVALID_CHARS_REGEX))
}

export function getTempFileName(f: TFile, prefix?: string): string {
	const parent = f.parent?.path ?? ""
	const sep = parent === "" ? "" : "/"
	const name = generateUUID()
	const ext = f.extension === "" ? "" : "." + f.extension

	return `${parent}${sep}${prefix ?? ""}${name}${ext}`
}
