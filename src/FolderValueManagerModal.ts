import { Modal, Setting } from "obsidian"
import AttachmentRenamerPlugin from "./main"

// this is essentially copied verbatim from Eldritch-Oliver/file-hider
// see: https://github.com/Eldritch-Oliver/file-hider

const NO_VALUES_TEXT =
	'No values to show. To create new values, right-click a folder in your explorer and click "Create folder template value."'

type OnDeleteCallback = () => void | Promise<void>

export class FolderValueManagerModal extends Modal {
	// TODO: clean this up, we shouldn't need the whole plugin
	private plugin: AttachmentRenamerPlugin
	private descEl: HTMLElement
	private onDelete: OnDeleteCallback

	constructor(plugin: AttachmentRenamerPlugin, onDelete: OnDeleteCallback) {
		super(plugin.app)
		this.plugin = plugin
		this.onDelete = onDelete
		this.setTitle("Folder template values")
	}

	onOpen() {
		const { contentEl: content } = this
		const body = content.createEl("div", { cls: "hidden-list-modal-body" })
		this.descEl = body.createEl("p")
		this.updateText()

		for (const key in this.plugin.settings.folderVals) {
			const s = new Setting(body)
				.setName(key)
				.setDesc(`Value: ${this.plugin.settings.folderVals[key]}`)
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
		delete this.plugin.settings.folderVals[key]
		await this.plugin.saveSettings()

		const d = this.onDelete()
		if (this.onDelete instanceof Promise) {
			await d
		}

		this.updateText()
	}

	private updateText() {
		if (Object.keys(this.plugin.settings.folderVals).length === 0) {
			this.descEl.setText(NO_VALUES_TEXT)
		}
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
