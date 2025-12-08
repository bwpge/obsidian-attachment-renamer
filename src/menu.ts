import { Menu, Notice, TFile, TFolder } from "obsidian"
import { FolderValueEditorModal } from "./FolderValueEditorModal"
import AttachmentRenamerPlugin from "./main"

export function addRenameInNoteMenuItem(plugin: AttachmentRenamerPlugin, menu: Menu, file: TFile) {
	menu.addItem((item) => {
		item.setTitle("Rename all attachments in note...")
			.setIcon("paperclip")
			.onClick(() => {
				plugin.renameAll(file).catch((e) => console.error(e))
			})
	})
	return
}

export function addEditFolderValueMenuItem(plugin: AttachmentRenamerPlugin, menu: Menu, folder: TFolder) {
	const key = folder.path
	const startValue = plugin.settings.folderVals[key]
	const onAccept = async (value: string) => {
		plugin.settings.folderVals[key] = value
		await plugin.saveSettings()
		new Notice(`Updated value for "${folder.name}"`)
	}

	if (key in plugin.settings.folderVals) {
		menu.addItem((item) => {
			item.setTitle("Edit folder template value")
				.setIcon("notepad-text-dashed")
				.onClick(() => {
					new FolderValueEditorModal(plugin.app, { key, startValue, onAccept }).open()
				})
		})
	} else {
		menu.addItem((item) => {
			item.setTitle("Create folder template value")
				.setIcon("notepad-text-dashed")
				.onClick(() => {
					new FolderValueEditorModal(plugin.app, {
						key,
						startValue,
						onAccept,
						title: "Create folder template value",
					}).open()
				})
		})
	}
}
