import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian"
import { NaivePath } from "./NaivePath"
import { RenameModal } from "./RenameModal"
import { TemplateEngine } from "./TemplateEngine"
import { deleteAttachment, renameAttachment } from "./utils"

interface AttachmentRenamerSettings {
	nameTemplate: string
	separator: string
	spaceReplacement: string
	alwaysNumber: boolean
	numberPadding: number
	deleteOnCancel: boolean
	autoRename: boolean
}

const DEFAULT_SETTINGS: AttachmentRenamerSettings = {
	nameTemplate: "{srcParent}/{docName}",
	separator: "-",
	spaceReplacement: "",
	alwaysNumber: false,
	numberPadding: 0,
	deleteOnCancel: false,
	autoRename: false,
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

		this.templater = new TemplateEngine(this.app)
		this.addSettingTab(new SampleSettingTab(this.app, this))
	}

	async openRenameModal(src: string) {
		const f = this.app.workspace.getActiveFile()
		if (!f) {
			new Notice("No active file")
			return
		}

		const dst = this.templater.render(src, this.settings)

		if (this.settings.autoRename) {
			const p = NaivePath.parse(dst, NaivePath.parseExtension(src))
			console.log(p)
			await p.updateIncrement(this.app, this.settings)
			await renameAttachment(this.app, src, p.renderPath(this.settings))
			return
		}

		new RenameModal(this.app, {
			src: src,
			dst: dst,
			settings: this.settings,
			onAccept: async (value) => {
				await renameAttachment(this.app, src, value)
			},
			onCancel: async () => {
				if (this.settings.deleteOnCancel) {
					await deleteAttachment(this.app, src)
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
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: AttachmentRenamerPlugin

	constructor(app: App, plugin: AttachmentRenamerPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName("Name template")
			.setDesc(
				"A template string which controls how the new name is generated. Click the help button for more information."
			)
			.setClass("attachment-renamer-setting-wrap")
			.addButton((button) => button.setIcon("help-circle"))
			.addText((text) =>
				text
					.setPlaceholder("{srcParent}/{noteName}")
					.setValue(this.plugin.settings.nameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.nameTemplate = value
						await this.plugin.saveSettings()
					})
					.inputEl.addClass("attachment-renamer-template-input")
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
			.setName("Auto rename")
			.setDesc("Rename attachments according to plugin settings without confirmation.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoRename).onChange(async (value) => {
					this.plugin.settings.autoRename = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Separator")
			.setDesc("Used to separate the attachment name and increment numbers, e.g., foo-02")
			.addText((text) =>
				text
					.setPlaceholder("-")
					.setValue(this.plugin.settings.separator)
					.onChange(async (value) => {
						this.plugin.settings.separator = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Space replacement")
			.setDesc(
				"Only used in the attachment name, not parent directories. Use NONE to replace spaces with an empty string. Leave empty to disable."
			)
			.addText((text) =>
				text
					.setPlaceholder("disabled")
					.setValue(this.plugin.settings.spaceReplacement)
					.onChange(async (value) => {
						this.plugin.settings.spaceReplacement = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Always number attachments")
			.setDesc(
				"If enabled, all attachments will be renamed with an increment e.g., foo-01. Otherwise, attachments will not have a number unless conflicting with an existing file."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.alwaysNumber).onChange(async (value) => {
					this.plugin.settings.alwaysNumber = value
					await this.plugin.saveSettings()
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
					})
			)
	}
}
