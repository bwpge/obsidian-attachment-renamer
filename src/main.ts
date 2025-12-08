import { App, EmbedCache, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFile, TFolder } from "obsidian"
import { HelpModal } from "./HelpModal"
import { NAME_TEMPLATE_HELP } from "./helpText"
import { FolderValueManagerModal } from "./FolderValueManagerModal"
import { NaivePath } from "./NaivePath"
import { RenameModal } from "./RenameModal"
import { TemplateEngine } from "./TemplateEngine"
import { getActiveEditor, getTempFileName, isValidInput, replaceCurrLineInEditor } from "./utils"
import { ConfirmModal } from "./ConfirmModal"
import { addEditFolderValueMenuItem, addRenameInNoteMenuItem } from "./menu"

interface AttachmentRenamerSettings {
	nameTemplate: string
	separator: string
	spaceReplacement: string
	alwaysNumber: boolean
	numberPadding: number
	transformName: string
	deleteOnCancel: boolean
	confirmRename: boolean
	confirmRenameAll: boolean
	createMissingDirs: boolean
	ignorePattern: string
	folderVals: { [key: string]: string }
}

const DEFAULT_SETTINGS: AttachmentRenamerSettings = {
	nameTemplate: "{srcParent}/{custom-}{noteName}",
	separator: "-",
	spaceReplacement: "",
	alwaysNumber: false,
	numberPadding: 0,
	transformName: "",
	deleteOnCancel: false,
	confirmRename: true,
	confirmRenameAll: true,
	createMissingDirs: false,
	ignorePattern: "",
	folderVals: {},
}

interface LinkStats {
	files: TFile[]
	ignored: number
	internal: number
	external: number
}

export default class AttachmentRenamerPlugin extends Plugin {
	settings: AttachmentRenamerSettings
	templater: TemplateEngine

	async onload() {
		await this.loadSettings()
		this.templater = new TemplateEngine(this.app, this.settings)
		this.addSettingTab(new AttachmentRenamerSettingTab(this.app, this))

		this.addCommand({
			id: "rename-all",
			name: "Rename all attachments in active note",
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile()
				if (!activeFile) {
					new Notice("No active file found")
					return
				}
				await this.renameAll(activeFile)
			},
		})

		this.registerEvent(
			this.app.vault.on("create", async (file) => {
				// always ignore directories and markdown files
				if (!(file instanceof TFile) || file.extension.toLowerCase() == "md") {
					return
				}

				// if the file was created more than 1 second ago, the event is most likely be fired on
				// vault initialization when starting Obsidian app, ignore it
				//
				// NOTE: found an odd bug on windows when pasting a file -> cancel/delete -> then pasting
				// the file again. it seems to use the old ctime when pasting it again, but i'm not sure
				// why. i assume it's because it uses the old name (previously deleted), might be some
				// filesystem weirdness on windows with NTFS.
				const createdMs = new Date().getTime() - file.stat.ctime
				if (createdMs > 1000) {
					return
				}

				if (this.shouldIgnore(file.path) || file.basename.startsWith("~")) {
					return
				}

				await this.openRenameModal(file.path)
			})
		)

		this.app.workspace.on("file-menu", (menu, f) => {
			if (f.path === "/") {
				return
			}

			if (f instanceof TFile) {
				if (f.extension.toLowerCase() !== "md") {
					return
				}
				addRenameInNoteMenuItem(this, menu, f)
			} else if (f instanceof TFolder) {
				addEditFolderValueMenuItem(this, menu, f)
			}
		})
	}

	async openRenameModal(src: string) {
		const f = this.app.workspace.getActiveFile()
		if (!f) {
			new Notice("No active file")
			return
		}

		const dst = this.templater.render(src)

		if (!this.settings.confirmRename) {
			const p = NaivePath.parse(dst, NaivePath.parseExtension(src))
			await p.updateCounter(this.app, this.settings)
			await this.renameAttachment(src, p.renderPath(this.settings))
			return
		}

		new RenameModal(this.app, {
			src: src,
			dst: dst,
			settings: this.settings,
			onAccept: async (value) => {
				await this.renameAttachment(src, value)
			},
			onCancel: async () => {
				if (this.settings.deleteOnCancel) {
					await this.deleteAttachment(src)
				}
			},
			onDontAskChanged: async (checked) => {
				this.settings.confirmRename = !checked
				await this.saveSettings()
			},
		}).open()
	}

	async renameAll(src: TFile) {
		const embeds = this.app.metadataCache.getFileCache(src)?.embeds
		if (!embeds) {
			new Notice(`No attachment links found in "${src.name}"`)
			return
		}

		const { files, ignored, external, internal } = this.getLinkStats(src, embeds)
		const filesAffected = `${files.length} ${files.length === 1 ? "attachment" : "attachments"}`
		const internalAffected = `${internal} ${internal === 1 ? "link" : "links"}`
		const externalText = `, and ${external} ${external === 1 ? "link" : "links"} in other notes`
		const ignoredText = ` The ignore pattern setting will skip ${ignored} ${ignored === 1 ? "attachment" : "attachments"}.`

		const doRenameAll = async () => {
			// move each file to a temp file first to avoid leap frogging attachment numbers
			for (const f of files) {
				const dst = getTempFileName(f, "renameall_")
				await this.app.fileManager.renameFile(f, dst)
			}

			for (const f of files) {
				const src = f.path
				const dst = this.templater.render(src)
				const p = NaivePath.parse(dst, f.extension)
				await p.updateCounter(this.app, this.settings)
				await this.renameAttachment(src, p.renderPath(this.settings))
			}
		}

		if (!this.settings.confirmRenameAll) {
			await doRenameAll()
			return
		}

		const body = [
			`Are you sure you want to rename all attachments in "${src.basename}"?`,
			`This will rename ${filesAffected} with ${internalAffected} in the target note${external > 0 ? externalText : ""}.${ignored > 0 ? ignoredText : ""}`,
		]
		const warning = [
			"Be sure that your plugin settings produce the desired attachment names. There is no confirmation for individual rename operations.",
			"There is no way to undo this operation. Always backup your vault before renaming all attachments.",
		]

		new ConfirmModal(this.app, {
			title: "Rename all attachments",
			body,
			warning,
			confirmButtonText: "Rename",
			onConfirm: doRenameAll,
			onDontAskChanged: async (checked) => {
				this.settings.confirmRenameAll = !checked
				await this.saveSettings()
			},
		}).open()
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
		this.templater.updateSettings(this.settings)
	}

	private async renameAttachment(src: string, dst: string, noUpdateEditor?: boolean) {
		const activeFile = this.app.workspace.getActiveFile()
		const srcFile = this.app.vault.getAbstractFileByPath(src)
		if (!(srcFile instanceof TFile)) {
			console.warn("cannot rename: src is not a file", src)
			return
		}
		if (!activeFile) {
			return
		}

		// need to capture this here because the rename changes srcFile
		const oldLink = this.app.fileManager.generateMarkdownLink(srcFile, activeFile.path)

		const p = NaivePath.parse(dst)

		const parentExists = await this.app.vault.adapter.exists(p.parent)
		if (!parentExists && !this.settings.createMissingDirs) {
			new Notice(`ERROR: cannot rename attachment, parent directory "${p.parent}" does not exist`)
			return
		}

		await this.app.vault.adapter.mkdir(p.parent)
		await this.app.fileManager.renameFile(srcFile, dst)

		if (noUpdateEditor) {
			return
		}

		const editor = getActiveEditor(this.app)
		if (!editor) {
			return
		}

		const dstFile = this.app.vault.getAbstractFileByPath(dst)
		if (!(dstFile instanceof TFile)) {
			console.warn("cannot rename: src is not a file", dst)
			return
		}

		const newLink = this.app.fileManager.generateMarkdownLink(dstFile, activeFile.path)
		replaceCurrLineInEditor(editor, oldLink, newLink)
	}

	private async deleteAttachment(src: string, noUpdateEditor?: boolean) {
		const f = this.app.vault.getAbstractFileByPath(src)

		// basic sanity check that this is actually a file to avoid nuking the user's vault if
		// something breaks in this plugin down the line
		if (!(f instanceof TFile)) {
			console.warn(`cannot delete, "${src}" is not a file`)
			return
		}

		await this.app.fileManager.trashFile(f)

		if (noUpdateEditor) {
			return
		}

		const activeFile = this.app.workspace.getActiveFile()
		const editor = getActiveEditor(this.app)
		if (!activeFile || !editor) {
			return
		}
		const linkText = this.app.fileManager.generateMarkdownLink(f, activeFile.path)
		replaceCurrLineInEditor(editor, `!${linkText}`, "")
	}

	private shouldIgnore(value: string): boolean {
		if (!this.settings.ignorePattern) {
			return false
		}

		for (const line of this.settings.ignorePattern.split("\n")) {
			if (!line) {
				continue
			}

			const pat = new RegExp(line)
			if (value.match(pat)) {
				return true
			}
		}

		return false
	}

	private getLinkStats(activeFile: TFile, embeds: EmbedCache[]): LinkStats {
		const seen = new Set()
		const files: TFile[] = []
		let ignored = 0
		let internal = 0
		let external = 0
		for (const embed of embeds) {
			const file = this.app.metadataCache.getFirstLinkpathDest(embed.link, activeFile.path)
			if (!file) {
				continue
			}
			if (this.shouldIgnore(file.path)) {
				ignored += 1
				continue
			}

			const links = this.app.metadataCache.resolvedLinks
			if (!links) {
				continue
			}

			if (seen.has(file.path)) {
				continue
			}
			seen.add(file.path)
			files.push(file)

			// PERF: this can get really expensive in a big vault
			const f = file.path
			for (const link in links) {
				const count = links[link][f] ?? 0
				if (link === activeFile.path) {
					internal += count
				} else {
					external += count
				}
			}
		}

		return { files, internal, external, ignored }
	}
}

class AttachmentRenamerSettingTab extends PluginSettingTab {
	plugin: AttachmentRenamerPlugin
	previewTid: NodeJS.Timeout
	loadingSpinner: HTMLElement | undefined
	previewText: HTMLElement | undefined

	constructor(app: App, plugin: AttachmentRenamerPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		let tmplTextBox: TextComponent | undefined
		new Setting(containerEl)
			.setName("Name template")
			.setDesc(
				"A template string which controls how the attachment path is generated. Click the help button for more information."
			)
			.setClass("attachment-renamer-setting-wrap")
			.addButton((button) =>
				button.setIcon("help-circle").onClick(() => {
					new HelpModal(this.app, "Name template", NAME_TEMPLATE_HELP).open()
				})
			)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SETTINGS.nameTemplate)
					.setValue(this.plugin.settings.nameTemplate)
					.onChange(async (value) => {
						await this.updateNameTemplate(value)
					})
					.inputEl.addClass("attachment-renamer-template-input")
				tmplTextBox = text
			})
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					tmplTextBox?.setValue(DEFAULT_SETTINGS.nameTemplate)
					await this.updateNameTemplate(DEFAULT_SETTINGS.nameTemplate)
				})
			)

		this.buildPreviewUI(containerEl)

		new Setting(containerEl)
			.setName("Folder template values")
			.setDesc("Sets the {custom} template variable based on the active note path when an attachment is created.")
			.addButton((button) =>
				button.setButtonText("Manage").onClick(() => {
					new FolderValueManagerModal(this.plugin, () => {
						this.updatePreview()
					}).open()
				})
			)

		new Setting(containerEl).setName("Filesystem").setHeading()

		new Setting(containerEl)
			.setName("Create missing directories")
			.setDesc("Create all missing intermediate directories when renaming an attachment")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createMissingDirs).onChange(async (value) => {
					this.plugin.settings.createMissingDirs = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Delete attachments if cancelled")
			.setDesc(
				"Delete attachments if the rename box is cancelled (e.g., with the escape key or cancel button). To keep the original name with this setting on, use the skip button."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.deleteOnCancel).onChange(async (value) => {
					this.plugin.settings.deleteOnCancel = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl).setName("Confirmation").setHeading()

		new Setting(containerEl)
			.setName("Confirm individual attachment rename")
			.setDesc("Ask before renaming an individual attachment.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmRename).onChange(async (value) => {
					this.plugin.settings.confirmRename = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Confirm when renaming all attachments")
			.setDesc("Ask before renaming all attachments in the active note.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmRenameAll).onChange(async (value) => {
					this.plugin.settings.confirmRenameAll = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl).setName("Attachment numbering").setHeading()

		new Setting(containerEl)
			.setName("Always number attachments")
			.setDesc(
				"Rename all attachments with a counter e.g., foo-1. Otherwise, only use a counter when the attachment name already exists."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.alwaysNumber).onChange(async (value) => {
					this.plugin.settings.alwaysNumber = value
					await this.plugin.saveSettings()
					this.updatePreview()
				})
			)

		new Setting(containerEl)
			.setName("Number padding")
			.setDesc(
				"Minimum number of digits an attachment number must have. For example, a value of 3 will result in 001, 042, 1000, etc."
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 10, 1)
					.setDynamicTooltip()
					.setInstant(false)
					.setValue(this.plugin.settings.numberPadding)
					.onChange(async (value) => {
						this.plugin.settings.numberPadding = value
						await this.plugin.saveSettings()
						this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("Separator")
			.setDesc(
				"Value used to separate different template values such as name and attachment counters, e.g., foo-42."
			)
			.addText((text) =>
				text
					.setPlaceholder("-")
					.setValue(this.plugin.settings.separator)
					.onChange(async (value) => {
						this.plugin.settings.separator = value
						await this.plugin.saveSettings()
						this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("String operations")
			.setHeading()
			.setDesc("These options only apply to the attachment name, not parent directories.")

		new Setting(containerEl)
			.setName("Space replacement")
			.setDesc('Use "NONE" to replace spaces with an empty string. Leave empty to disable.')
			.addText((text) =>
				text
					.setPlaceholder("Disabled")
					.setValue(this.plugin.settings.spaceReplacement)
					.onChange(async (value) => {
						this.plugin.settings.spaceReplacement = value
						await this.plugin.saveSettings()
						this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("Transform name")
			.setDesc("Change the attachment name to uppercase or lowercase.")
			.addDropdown((menu) =>
				menu
					.addOptions({
						"": "None",
						lower: "Lowercase",
						upper: "Uppercase",
					})
					.setValue(this.plugin.settings.transformName)
					.onChange(async (value) => {
						this.plugin.settings.transformName = value
						await this.plugin.saveSettings()
						this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("Ignore patterns")
			.setDesc(
				"Skip processing attachments whose path matches any of these patterns. The full path is tested, including attachment extension. Each line is treated as a separate regular expression. Empty lines are ignored."
			)
			.setClass("attachment-renamer-setting-wrap")
			.addTextArea((text) => {
				const inputEl = text
					.setPlaceholder("\\.(docx|pptx|xlsx)$\n^my/protected/folder")
					.setValue(this.plugin.settings.ignorePattern)
					.onChange(async (value) => {
						this.plugin.settings.ignorePattern = value
						await this.plugin.saveSettings()
					}).inputEl
				inputEl.rows = 8
				inputEl.cols = 40
			})
	}

	private async updateNameTemplate(value: string) {
		this.plugin.settings.nameTemplate = value
		await this.plugin.saveSettings()
		this.updatePreview()
	}

	private buildPreviewUI(el: HTMLElement) {
		const previewDiv = el.createDiv({ cls: "attachment-renamer-template-preview" })
		this.loadingSpinner = previewDiv?.createDiv({ cls: "attachment-renamer-spinner-small" })
		this.loadingSpinner.hide()
		this.previewText = previewDiv.createDiv({ text: "Preview:" })
		this.updatePreview()
	}

	updatePreview() {
		clearTimeout(this.previewTid)
		if (!isValidInput(this.plugin.settings.nameTemplate)) {
			this.loadingSpinner?.hide()
			this.previewText?.setText("Preview:")
			return
		}

		this.loadingSpinner?.show()
		this.previewTid = setTimeout(() => {
			const f = this.app.workspace.getActiveFile()
			if (f) {
				const t = this.plugin.templater.render("attachments/Pasted image 20251205121921.png")
				const p = NaivePath.parse(t, "png")
				p.updateCounter(this.app, this.plugin.settings)
					.then(() => {
						this.previewText?.setText(`Preview: ${p.renderPath(this.plugin.settings)}`)
						this.loadingSpinner?.hide()
					})
					.catch((e) => console.error(e))
			} else {
				this.loadingSpinner?.hide()
				this.previewText?.setText("Preview not available (no active file)")
			}
		}, 250)
	}
}
