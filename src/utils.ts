import { App, Editor, MarkdownView, TFile } from "obsidian"
import { NaivePath } from "./NaivePath"

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
	} catch (err) {
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

export async function deleteAttachment(app: App, src: string, noUpdateEditor?: boolean) {
	const f = app.vault.getAbstractFileByPath(src)

	// basic sanity check that this is actually a file to avoid nuking the user's vault if
	// something breaks in this plugin down the line
	if (!(f instanceof TFile)) {
		console.log("something broke, src is not a file", src)
		return
	}

	app.vault.delete(f)

	if (noUpdateEditor) {
		return
	}

	const activeFile = app.workspace.getActiveFile()
	const editor = getActiveEditor(app)
	if (!activeFile || !editor) {
		return
	}
	const linkText = app.fileManager.generateMarkdownLink(f, activeFile.path)
	replaceCurrLineInEditor(editor, `!${linkText}`, "")
}

export async function renameAttachment(app: App, src: string, dst: string, noUpdateEditor?: boolean) {
	const activeFile = app.workspace.getActiveFile()
	const srcFile = app.vault.getAbstractFileByPath(src)
	if (!(srcFile instanceof TFile)) {
		console.log("something broke, src is not a file", src)
		return
	}
	if (!activeFile) {
		return
	}

	// need to capture this here because the rename changes srcFile
	const oldLink = app.fileManager.generateMarkdownLink(srcFile, activeFile.path)

	const p = NaivePath.parse(dst)
	await app.vault.adapter.mkdir(p.parent)
	await app.fileManager.renameFile(srcFile, dst)

	if (noUpdateEditor) {
		return
	}

	const editor = getActiveEditor(app)
	if (!editor) {
		return
	}

	const dstFile = app.vault.getAbstractFileByPath(dst)
	if (!(dstFile instanceof TFile)) {
		console.log("something broke, dst is not a file", dst)
		return
	}

	const newLink = app.fileManager.generateMarkdownLink(dstFile, activeFile.path)
	console.log(`updating text: "${oldLink}" => "${newLink}"`)
	replaceCurrLineInEditor(editor, oldLink, newLink)
}

export function splitLast(value: string, separator: string): [string, string | undefined] {
	const idx = value.lastIndexOf(separator) ?? -1

	if (idx < 0) {
		return [value, undefined]
	}

	return [value.slice(0, idx), value.slice(idx + separator.length)]
}
