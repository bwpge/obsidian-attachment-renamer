import { App, EditorPosition, HeadingCache, MarkdownView } from "obsidian"
import { NaivePath } from "./NaivePath"
import { generateUUID, splitLast } from "./utils"

const SPACES_PATTERN = /\s/g
const TEMPALTE_VAR = /{{?\s*([\w:-]+)\s*}?}/g

export type TemplateValue = string | ((str?: string) => string)
export type TemplateVars = {
	[key: string]: TemplateValue
}

interface TemplateSettings {
	nameTemplate: string
	separator: string
	spaceReplacement: string
	transformName: string
	folderVals: { [key: string]: string }
}

interface ParsedVar {
	ns: string
	name: string
	prefix: boolean
	suffix: boolean
}

function parseVar(value: string): ParsedVar {
	const result = {
		ns: "",
		name: "",
		prefix: false,
		suffix: false,
	}

	let v = value.replace(SPACES_PATTERN, "")
	if (v.startsWith("-")) {
		v = v.slice(1)
		result.prefix = true
	}
	if (v.endsWith("-")) {
		v = v.slice(0, -1)
		result.suffix = true
	}

	if (v.contains(":")) {
		const [before, after] = v.split(":", 2)
		result.ns = before.trim()
		v = after.trim()
	}

	result.name = v
	return result
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

export class TemplateEngine {
	private app: App
	private settings: TemplateSettings

	constructor(app: App, settings: TemplateSettings) {
		this.app = app
		this.settings = settings
	}

	updateSettings(settings: TemplateSettings) {
		this.settings = settings
	}

	render(src: string) {
		const vars = this.buildVars(src, this.settings)
		const now = window.moment()

		let rendered = this.settings.nameTemplate.replace(TEMPALTE_VAR, (match, k: string) => {
			const tvar = parseVar(k)
			if (!tvar) {
				return ""
			}

			if (tvar.ns == "DATE") {
				return now.format(tvar.name)
			}

			if (tvar.name in vars) {
				const value = vars[tvar.name]
				let output = ""
				if (typeof value == "string") {
					output = value
				} else {
					output = value()
				}

				return this.renderVar(tvar, output)
			}

			console.warn(`unknown template variable '${tvar.name}'`)
			return match
		})

		// TODO: we shouldn't have to keep splitting the rendered value, need to fix
		rendered = this.applyTransform(this.replaceSpaces(rendered))

		return rendered
	}

	private buildVars(src: string, settings: TemplateSettings): TemplateVars {
		const activeFile = this.app.workspace.getActiveFile()
		const srcFile = NaivePath.parse(src)

		let header: TemplateValue = ""
		if (activeFile) {
			const cache = this.app.metadataCache.getFileCache(activeFile)
			if (cache) {
				const cursor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor?.getCursor()
				header = () => getNearestHeading(cache.headings, cursor)
			} else {
				console.warn("could not get file cache from active file", activeFile.name)
			}
		}

		return {
			noteName: activeFile?.basename ?? "",
			noteParent: activeFile?.parent?.path ?? "",
			srcName: srcFile.basename,
			srcParent: srcFile.parent,
			extension: srcFile.extension,
			header,
			separator: settings.separator,
			uuid: generateUUID,
			custom: () => this.getCustomValue(settings, activeFile?.parent?.path),
		}
	}

	private renderVar(tvar: ParsedVar, value: string): string {
		const sep = this.settings.separator
		if (!value) {
			return ""
		}
		const prefix = tvar.prefix ? sep : ""
		const suffix = tvar.suffix ? sep : ""

		return `${prefix}${value}${suffix}`
	}

	private getCustomValue(settings: TemplateSettings, input?: string): string {
		if (!input) {
			return ""
		}

		let rank = -1
		let result = ""
		for (const key in settings.folderVals) {
			if (input.startsWith(key)) {
				const value = settings.folderVals[key]
				const r = key.split("/").length
				if (r > rank) {
					rank = r
					result = value
				}
			}
		}

		return result
	}

	private replaceSpaces(rendered: string): string {
		if (!this.settings.spaceReplacement || !rendered.contains(" ")) {
			return rendered
		}

		const replace = this.settings.spaceReplacement === "NONE" ? "" : this.settings.spaceReplacement
		if (!rendered.contains("/")) {
			return rendered.replace(SPACES_PATTERN, replace)
		}

		const [before, after] = splitLast(rendered, "/")
		if (!after) {
			return rendered
		}

		return `${before}/${after.replace(SPACES_PATTERN, replace)}`
	}

	private applyTransform(value: string): string {
		if (!this.settings.transformName) {
			return value
		}

		const transform = (s: string) => {
			if (this.settings.transformName == "upper") {
				return s.toUpperCase()
			} else if (this.settings.transformName == "lower") {
				return s.toLowerCase()
			}
			return s
		}

		if (!value.contains("/")) {
			return transform(value)
		}

		const [before, after] = splitLast(value, "/")
		return `${before}/${transform(after ?? "")}`
	}
}
