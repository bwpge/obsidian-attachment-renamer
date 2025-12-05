import { App, ButtonComponent, Modal, TextComponent } from "obsidian"

type AcceptCallback = (value: string) => Promise<void>

export class CreateFolderTemplateModal extends Modal {
	key = ""
	value = ""
	composing = false
	onAccept?: AcceptCallback

	constructor(app: App, key: string, onAccept?: AcceptCallback) {
		super(app)
		this.key = key
		this.onAccept = onAccept
		this.setTitle("Create folder template value")
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl("p", {
			text: "This will set the {custom} template variable if an attachment is created in an active note anywhere under this folder.",
		})

		contentEl.createEl("p", {
			text: "Values for deeper paths take priority over shallow ones (e.g., foo/bar/baz will take priority over foo/bar).",
		})

		const textComp = new TextComponent(contentEl).onChange((value) => (this.value = value))
		textComp.inputEl.addClass("attachment-renamer-modal-input")
		textComp.inputEl.addEventListener("compositionstart", async () => {
			this.composing = true
		})
		textComp.inputEl.addEventListener("compositionend", async () => {
			this.composing = false
		})
		textComp.inputEl.addEventListener("keydown", async (e) => {
			if (e.key === "Enter" && !this.composing) {
				e.preventDefault()
				await this.accept()
			}
		})
		textComp.inputEl.select()

		const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" })
		new ButtonComponent(buttonContainer)
			.setButtonText("Create")
			.setCta()
			.onClick(() => this.accept())
		new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => this.close())
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}

	private async accept() {
		if (this.onAccept) {
			await this.onAccept(this.value)
		}
		this.close()
	}
}
