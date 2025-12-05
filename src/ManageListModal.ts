import { Modal, Setting } from "obsidian"
import AttachmentRenamerPlugin from "./main"

// this is essentially copied verbatim from Eldritch-Oliver/file-hider
// see: https://github.com/Eldritch-Oliver/file-hider

const NO_VALUES_TEXT =
	'No values to show. To create new values, right-click a folder in your explorer and click "Create folder template value."'

export class ManageFolderValueModal extends Modal {
	private plugin: AttachmentRenamerPlugin
	private introEl: HTMLElement

	constructor(plugin: AttachmentRenamerPlugin) {
		super(plugin.app)
		this.plugin = plugin
		this.setTitle("Folder template values")
	}

	onOpen() {
		const { contentEl: content } = this
		const body = content.createEl("div", { cls: "hidden-list-modal-body" })
		this.introEl = body.createEl("p")
		this.updateText()

		for (const key in this.plugin.settings.customTemplateVals) {
			const s = new Setting(body)
				.setName(key)
				.setDesc(`Value: ${this.plugin.settings.customTemplateVals[key]}`)
				.addButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Delete")
						.onClick(async () => {
							await this.deleteKey(key)
							s.settingEl.hide()
						})
				})
		}
	}

	private async deleteKey(key: string) {
		delete this.plugin.settings.customTemplateVals[key]
		await this.plugin.saveSettings()
		this.updateText()
	}

	private updateText() {
		if (Object.keys(this.plugin.settings.customTemplateVals).length === 0) {
			this.introEl.setText(NO_VALUES_TEXT)
		}
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
