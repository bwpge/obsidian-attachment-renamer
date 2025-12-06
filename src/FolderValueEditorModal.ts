import { App, ButtonComponent, Modal, TextComponent } from "obsidian"

type AcceptCallback = (value: string) => Promise<void>

interface FolderValueEditorArgs {
	key: string
	title?: string
	startValue?: string
	onAccept?: AcceptCallback
}

export class FolderValueEditorModal extends Modal {
	key = ""
	value = ""
	composing = false
	onAccept?: AcceptCallback

	constructor(app: App, args: FolderValueEditorArgs) {
		super(app)
		this.key = args.key
		this.value = args.startValue ?? ""
		this.onAccept = args.onAccept
		this.setTitle(args.title ?? "Edit folder template value")
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl("p", {
			text: "This will set the {custom} template variable if an attachment is created in an active note anywhere under this folder.",
		})

		contentEl.createEl("p", {
			text: "Values for deeper paths take priority over shallow ones (e.g., foo/bar/baz will take priority over foo/bar).",
		})

		const textComp = new TextComponent(contentEl).setValue(this.value).onChange((value) => (this.value = value))
		textComp.inputEl.addClass("attachment-renamer-modal-input")
		textComp.inputEl.addEventListener("compositionstart", () => {
			this.composing = true
		})
		textComp.inputEl.addEventListener("compositionend", () => {
			this.composing = false
		})
		textComp.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !this.composing) {
				e.preventDefault()
				this.accept().catch((e) => console.error(e))
			}
		})
		textComp.inputEl.select()

		const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" })
		new ButtonComponent(buttonContainer)
			.setButtonText("Save")
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
