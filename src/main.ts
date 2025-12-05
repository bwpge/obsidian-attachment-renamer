import { App, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFile, TFolder } from "obsidian"
import { FolderValueEditorModal } from "./FolderValueEditorModal"
import { HelpModal } from "./HelpModal"
import { NAME_TEMPLATE_HELP } from "./helpText"
import { FolderValueManagerModal } from "./FolderValueManagerModal"
import { NaivePath } from "./NaivePath"
import { RenameModal } from "./RenameModal"
import { TemplateEngine } from "./TemplateEngine"
import { getActiveEditor, isValidInput, replaceCurrLineInEditor } from "./utils"

interface AttachmentRenamerSettings {
	nameTemplate: string
	separator: string
	spaceReplacement: string
	alwaysNumber: boolean
	numberPadding: number
	transformName: string
	deleteOnCancel: boolean
	autoRename: boolean
	createMissingDirs: boolean
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
	autoRename: false,
	createMissingDirs: true,
	folderVals: {},
}

export default class AttachmentRenamerPlugin extends Plugin {
	settings: AttachmentRenamerSettings
	templater: TemplateEngine

	async onload() {
		await this.loadSettings()

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

				if (file.basename.startsWith("~")) {
					return
				}

				await this.openRenameModal(file.path)
			})
		)

		this.app.workspace.on("file-menu", (menu, f) => {
			if (!(f instanceof TFolder) || f.path === "/") {
				return
			}

			const key = f.path
			const startValue = this.settings.folderVals[key]
			const onAccept = async (value: string) => {
				this.settings.folderVals[key] = value
				await this.saveSettings()
				new Notice(`Updated value for "${f.name}"`)
			}

			if (key in this.settings.folderVals) {
				menu.addItem((item) => {
					item.setTitle("Edit folder template value")
						.setIcon("notepad-text-dashed")
						.onClick(async () => {
							new FolderValueEditorModal(this.app, { key, startValue, onAccept }).open()
						})
				})
			} else {
				menu.addItem((item) => {
					item.setTitle("Create folder template value")
						.setIcon("notepad-text-dashed")
						.onClick(async () => {
							new FolderValueEditorModal(this.app, { key, startValue, onAccept }).open()
						})
				})
			}
		})

		this.templater = new TemplateEngine(this.app, this.settings)
		this.addSettingTab(new SampleSettingTab(this.app, this))
	}

	async openRenameModal(src: string) {
		const f = this.app.workspace.getActiveFile()
		if (!f) {
			new Notice("No active file")
			return
		}

		const dst = this.templater.render(src)

		if (this.settings.autoRename) {
			const p = NaivePath.parse(dst, NaivePath.parseExtension(src))
			console.log(p)
			await p.updateIncrement(this.app, this.settings)
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
			onDontAskChanged: async (value) => {
				this.settings.autoRename = value
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
			console.log("something broke, src is not a file", src)
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
			console.log("something broke, dst is not a file", dst)
			return
		}

		const newLink = this.app.fileManager.generateMarkdownLink(dstFile, activeFile.path)
		console.log(`updating text: "${oldLink}" => "${newLink}"`)
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

		this.app.vault.delete(f)

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
}

class SampleSettingTab extends PluginSettingTab {
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
				button.setButtonText("Manage").onClick(async () => {
					new FolderValueManagerModal(this.plugin, async () => {
						await this.updatePreview()
					}).open()
				})
			)

		new Setting(containerEl).setName("Behavior").setHeading()

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
				"Delete attachments if the rename box is cancelled (e.g., with Esc key or Cancel button). To keep the original name with this setting on, use the Skip button."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.deleteOnCancel).onChange(async (value) => {
					this.plugin.settings.deleteOnCancel = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Automatically rename attachments")
			.setDesc("Do not show a confirmation prompt to rename attachments.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoRename).onChange(async (value) => {
					this.plugin.settings.autoRename = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl).setName("Attachment numbering").setHeading()

		new Setting(containerEl)
			.setName("Always number attachments")
			.setDesc(
				"Rename all attachments with an increment e.g., foo-01. Otherwise, only use an increment when the attachment name already exists."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.alwaysNumber).onChange(async (value) => {
					this.plugin.settings.alwaysNumber = value
					await this.plugin.saveSettings()
					await this.updatePreview()
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
						await this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("Separator")
			.setDesc(
				"Value used to separate different template values such as name and increment numbers, e.g., foo-02."
			)
			.addText((text) =>
				text
					.setPlaceholder("-")
					.setValue(this.plugin.settings.separator)
					.onChange(async (value) => {
						this.plugin.settings.separator = value
						await this.plugin.saveSettings()
						await this.updatePreview()
					})
			)

		new Setting(containerEl)
			.setName("String operations")
			.setHeading()
			.setDesc("These options only apply to the attachment name, not parent directories.")

		new Setting(containerEl)
			.setName("Space replacement")
			.setDesc("Use NONE to replace spaces with an empty string. Leave empty to disable.")
			.addText((text) =>
				text
					.setPlaceholder("disabled")
					.setValue(this.plugin.settings.spaceReplacement)
					.onChange(async (value) => {
						this.plugin.settings.spaceReplacement = value
						await this.plugin.saveSettings()
						await this.updatePreview()
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
						await this.updatePreview()
					})
			)
	}

	private async updateNameTemplate(value: string) {
		this.plugin.settings.nameTemplate = value
		await this.plugin.saveSettings()
		await this.updatePreview()
	}

	private buildPreviewUI(el: HTMLElement) {
		const previewDiv = el.createDiv({ cls: "attachment-renamer-template-preview" })
		this.loadingSpinner = previewDiv?.createDiv({ cls: "attachment-renamer-spinner-small" })
		this.loadingSpinner.hide()
		this.previewText = previewDiv.createDiv({ text: "Preview:" })
		this.updatePreview()
	}

	async updatePreview() {
		clearTimeout(this.previewTid)
		if (!isValidInput(this.plugin.settings.nameTemplate)) {
			this.loadingSpinner?.hide()
			this.previewText?.setText("Preview:")
			return
		}

		this.loadingSpinner?.show()
		this.previewTid = setTimeout(async () => {
			const f = this.app.workspace.getActiveFile()
			if (f) {
				const t = this.plugin.templater.render("attachments/Pasted image 20251205121921.png")
				const p = NaivePath.parse(t, "png")
				await p.updateIncrement(this.app, this.plugin.settings)
				this.previewText?.setText(`Preview: ${p.renderPath(this.plugin.settings)}`)
				this.loadingSpinner?.hide()
			} else {
				this.loadingSpinner?.hide()
				this.previewText?.setText("Preview not available (no active file)")
			}
		}, 250)
	}
}
