import { App, EditorPosition, HeadingCache, MarkdownView } from "obsidian"
import { NaivePath } from "./NaivePath"
import { generateUUID, splitLast } from "./utils"

const tmplVar = /{{?\s*([\w:-]+)\s*}?}/g

export type TemplateValue = string | ((str?: string) => string)
export type TemplateVars = {
	[key: string]: TemplateValue
}

interface TemplateSettings {
	nameTemplate: string
	separator: string
	spaceReplacement: string
}

function getNearestHeading(headings?: HeadingCache[], cursor?: EditorPosition): string {
	if (!headings || headings.length <= 0) {
		return ""
	}
	if (!cursor) {
		return ""
	}

	let h = ""
	let dist = -1

	// unfortunately we have to iterate through all headings because the cache is not guaranteed to be
	// sorted by line or cursor position
	for (const heading of headings) {
		const d = cursor.line - heading.position.start.line
		if (d < 0) {
			continue
		}
		if (d < dist || dist < 0) {
			h = heading.heading
			dist = d
		}
	}

	return h
}

function buildVars(app: App, src: string, settings: TemplateSettings): TemplateVars {
	const activeFile = app.workspace.getActiveFile()
	const srcFile = NaivePath.parse(src)

	let header: TemplateValue = ""
	const separator = settings.separator

	if (activeFile) {
		const cache = app.metadataCache.getFileCache(activeFile)
		if (cache) {
			const cursor = app.workspace.getActiveViewOfType(MarkdownView)?.editor?.getCursor()
			header = () => getNearestHeading(cache.headings, cursor)
		} else {
			console.warn("could not get file cache from active file", activeFile.name)
		}
	}

	return {
		docName: activeFile?.basename ?? "",
		docParent: activeFile?.parent?.path ?? "",
		srcName: srcFile.basename,
		srcParent: srcFile.parent,
		extension: srcFile.extension,
		header,
		separator,
		uuid: generateUUID,
	}
}

export function renderTemplate(app: App, src: string, settings: TemplateSettings) {
	const vars = buildVars(app, src, settings)
	const now = window.moment()
	const sep = vars["separator"] ?? ""

	const rendered = settings.nameTemplate.replace(tmplVar, (match, k: string) => {
		let key = k.replace(/\s/g, "")
		let hasPrefix = false
		let hasSuffix = false
		if (key.startsWith("-")) {
			key = key.slice(1)
			hasPrefix = true
		}
		if (key.endsWith("-")) {
			key = key.slice(0, -1)
			hasSuffix = true
		}

		if (!key) {
			return ""
		}

		const formatValue = (v: string) => {
			if (!v || !sep) {
				return v
			}
			const prefix = hasPrefix ? sep : ""
			const suffix = hasSuffix ? sep : ""
			return `${prefix}${v}${suffix}`
		}

		if (key.contains(":")) {
			const [prefix, value] = key.split(":", 2)
			if (prefix == "DATE") {
				return now.format(value)
			}
			return ""
		}

		if (key in vars) {
			const value = vars[key]
			let result = ""
			if (typeof value == "string") {
				result = value
			} else {
				result = value()
			}

			return formatValue(result)
		}

		console.warn(`unknown template variable '${key}'`)
		return match
	})

	if (!settings.spaceReplacement || !rendered.contains(" ")) {
		return rendered
	}

	const replace = settings.spaceReplacement === "NONE" ? "" : settings.spaceReplacement
	if (!rendered.contains("/")) {
		return rendered.replace(/\s/g, replace)
	}

	// only replace spaces in the final segment to avoid messing with paths

	// eslint-disable-next-line prefer-const
	let [before, after] = splitLast(rendered, "/")
	if (!after) {
		return rendered
	}
	after = after.replace(/\s/g, replace)
	return `${before}/${after}`
}
