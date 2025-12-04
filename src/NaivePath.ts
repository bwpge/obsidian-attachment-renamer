import { App } from "obsidian"

export interface RenderPathOpts {
	separator?: string
	alwaysNumber?: boolean
	numberPadding?: number
}

export class NaivePath {
	original = ""
	parent = ""
	basename = ""
	extension = ""
	increment = 0

	static parse(src: string, overrideExtension?: string): NaivePath {
		const p = new NaivePath()
		if (!src) {
			return p
		}

		p.original = src
		const parts = splitPath(src)
		const name = parts.pop() ?? ""
		p.parent = parts.join("/")

		// don't parse extension if already provided
		if (overrideExtension) {
			p.basename = name
			p.extension = overrideExtension
			return p
		}

		const extIdx = name.lastIndexOf(".") ?? -1
		if (extIdx > 0) {
			p.basename = name.slice(0, extIdx)
			p.extension = name.slice(extIdx + 1)
		} else {
			p.basename = name
			p.extension = ""
		}

		return p
	}

	static parseExtension(value: string): string {
		const extIdx = value.lastIndexOf(".") ?? -1
		return extIdx > 0 ? value.slice(extIdx + 1) : ""
	}

	get name(): string {
		return `${this.basename}${this.extension ? "." : ""}${this.extension}`
	}

	get path(): string {
		return this.parent === "" ? this.name : `${this.parent}/${this.name}`
	}

	get pathNoExt(): string {
		return this.parent === "" ? this.basename : `${this.parent}/${this.basename}`
	}

	async updateIncrement(app: App, opts: RenderPathOpts) {
		let listed
		try {
			listed = await app.vault.adapter.list(this.parent)
		} catch {
			console.warn(`could not list ${this.parent}`)
			this.increment = 0
			return
		}

		let num = -1
		let exists = opts.alwaysNumber ?? false
		for (const item of listed.files) {
			const p = NaivePath.parse(item)
			if (!p.basename.startsWith(this.basename)) {
				continue
			}

			// we compare basename to avoid issues where attachments only differ in extension, which
			// otherwise makes increment numbers overlap
			if (p.basename == this.basename) {
				exists = true
				continue
			}

			let suffix = p.basename.slice(this.basename.length)
			if (opts.separator) {
				// need to match the current separator or else parsing numbers can get weird
				if (suffix.startsWith(opts.separator)) {
					suffix = suffix.slice(opts.separator.length)
				} else {
					continue
				}
			}

			const n = parseInt(suffix)
			if (n && n >= 0) {
				num = Math.max(num, n + 1)
			}
		}

		if (num > 0) {
			this.increment = num
		} else {
			this.increment = exists ? 1 : 0
		}
	}

	renderBaseName(opts?: RenderPathOpts): string {
		const basename = this.basename
		if (!opts?.alwaysNumber && this.increment <= 0) {
			return basename
		}

		const n = String(this.increment).padStart(opts?.numberPadding ?? 0, "0")
		return `${basename}${opts?.separator ?? ""}${n}`
	}

	renderName(opts?: RenderPathOpts): string {
		const basename = this.renderBaseName(opts)
		return `${basename}${this.extension ? "." : ""}${this.extension}`
	}

	renderPath(opts?: RenderPathOpts): string {
		const name = this.renderName(opts)
		return this.parent === "" ? name : `${this.parent}/${name}`
	}

	renderPathNoExt(opts?: RenderPathOpts): string {
		const name = this.renderBaseName(opts)
		return this.parent === "" ? name : `${this.parent}/${name}`
	}
}

function splitPath(value: string): string[] {
	return value.split("/").filter((x) => !(x.trim() === "" || x === "." || x === ".."))
}
