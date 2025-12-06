import { App, ButtonComponent, Component, MarkdownRenderer, Modal } from "obsidian"

export class HelpModal extends Modal {
	component: Component
	title: string
	markdown: string

	constructor(app: App, title: string, markdown: string) {
		super(app)
		this.component = new Component()
		this.title = title
		this.markdown = markdown
	}

	onOpen() {
		const { contentEl, titleEl } = this
		titleEl.setText(this.title)
		this.containerEl.addClass("attachment-renamer-help")

		const d = contentEl.createDiv({ cls: "markdown-rendered" })
		MarkdownRenderer.render(this.app, this.markdown, d, "", this.component).catch((e) => console.error(e))

		const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" })
		new ButtonComponent(buttonContainer).setButtonText("Close").onClick(() => this.close())
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
		this.component.unload()
	}
}
