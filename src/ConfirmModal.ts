import { App, ButtonComponent, Modal } from "obsidian"

interface ConfirmModalArgs {
	title: string
	body: string | string[]
	warning?: string | string[]
	confirmButtonText: string
	onConfirm: () => Promise<void>
	onDontAskChanged?: (checked: boolean) => Promise<void>
}

export class ConfirmModal extends Modal {
	body: string[]
	warning: string[]
	confirmButtonText: string
	onConfirm?: () => Promise<void>
	onDontAskChanged?: (checked: boolean) => Promise<void>

	constructor(app: App, args: ConfirmModalArgs) {
		super(app)
		if (typeof args.body === "string") {
			this.body = [args.body]
		} else {
			this.body = args.body
		}
		if (typeof args.warning === "string") {
			this.warning = [args.warning]
		} else {
			this.warning = args.warning ?? []
		}
		this.onConfirm = args.onConfirm
		this.confirmButtonText = args.confirmButtonText
		this.onDontAskChanged = args.onDontAskChanged
		this.setTitle(args.title)
	}

	onOpen() {
		const { contentEl } = this
		this.containerEl.addClass("mod-confirm")
		for (const text of this.body) {
			contentEl.createEl("p", { text })
		}
		for (const text of this.warning) {
			contentEl.createEl("p", { text, cls: "mod-warning" })
		}

		const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" })
		const checkBoxLabel = buttonContainer.createEl("label", { cls: "mod-checkbox" })
		const checkBox = checkBoxLabel.createEl("input", { type: "checkbox" })
		checkBox.addEventListener("change", () => {
			if (this.onDontAskChanged) {
				this.onDontAskChanged(checkBox.checked).catch((e) => console.error(e))
			}
		})
		checkBoxLabel.appendText("Don't ask again")
		checkBox.tabIndex = -1

		new ButtonComponent(buttonContainer)
			.setButtonText(this.confirmButtonText)
			.setWarning()
			.onClick(() => this.confirm())
		new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => this.close())
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}

	confirm() {
		this.close()
		if (this.onConfirm) {
			this.onConfirm().catch((e) => console.error(e))
		}
	}
}
