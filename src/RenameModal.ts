import { App, ButtonComponent, Modal, TextComponent, TFile } from "obsidian"
import { NaivePath } from "./NaivePath"
import { isImageExt, isValidInput } from "./utils"

type RenameFunc = (value: string) => Promise<void>
type ResultFunc = () => Promise<void>

interface RenameModalArgs {
	src: string
	dst: string
	settings: RenameOpts
	onAccept?: RenameFunc
	onCancel?: ResultFunc
	onSkip?: ResultFunc
	onDontAskChanged?: (checked: boolean) => Promise<void>
}

export interface RenameOpts {
	separator?: string
	alwaysNumber?: boolean
	numberPadding?: number
}

export class RenameModal extends Modal {
	src: NaivePath
	originalVal: string
	settings: RenameOpts

	// state
	value: string
	isValid = true
	acceptRename = false
	skipRename = false
	composing = false

	// callbacks
	onAccept?: RenameFunc
	onCancel?: ResultFunc
	onSkip?: ResultFunc
	onDontAskChanged?: (checked: boolean) => Promise<void>

	// ui components
	tid: NodeJS.Timeout
	dstEl: HTMLElement | undefined
	textComp: TextComponent | undefined
	renameButton: ButtonComponent | undefined
	loadingSpinner: HTMLElement | undefined

	constructor(app: App, args: RenameModalArgs) {
		super(app)
		this.src = NaivePath.parse(args.src)
		this.originalVal = args.dst
		this.value = args.dst
		this.isValid = isValidInput(this.value)
		this.settings = args.settings
		this.onAccept = args.onAccept
		this.onCancel = args.onCancel
		this.onSkip = args.onSkip
		this.onDontAskChanged = args.onDontAskChanged

		this.setTitle("Rename attachment")
	}

	async onOpen() {
		this.containerEl.addClass("attachment-renamer-modal")
		const { contentEl } = this
		this.buildPreviewContainer(contentEl)
		this.buildInputComponents(contentEl)
		await this.resetUI()
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()

		this.onCloseAsync().catch((e) => console.error(e))
		this.acceptRename = false
		this.skipRename = false
	}

	private async onCloseAsync() {
		if (this.skipRename) {
			if (this.onSkip) {
				await this.onSkip()
			}
			return
		}
		if (this.acceptRename) {
			if (this.onAccept) {
				const p = NaivePath.parse(this.value, this.src.extension)
				await p.updateCounter(this.app, this.settings)
				await this.onAccept(p.renderPath(this.settings))
			}
		} else {
			if (this.onCancel) {
				await this.onCancel()
			}
		}
	}

	private accept() {
		this.acceptRename = true
		this.close()
	}

	private buildPreviewContainer(el: HTMLElement) {
		const imgEl = el.createDiv({ cls: "attachment-renamer-image-preview" })
		const imgFile = this.app.vault.getAbstractFileByPath(this.src.original)

		if (imgFile && imgFile instanceof TFile && isImageExt(imgFile.extension)) {
			imgEl.createEl("img", {
				attr: {
					src: this.app.vault.getResourcePath(imgFile),
				},
			})
		} else {
			imgEl.setText("Preview not available")
		}

		const t = el.createEl("table", { cls: "attachment-renamer-info" })
		const src = t.createEl("tr")
		src.createEl("td", { text: "Source", cls: "attachment-renamer-label" })
		src.createEl("td", { text: this.src.path })
		const dst = t.createEl("tr")
		dst.createEl("td", { text: "Destination", cls: "attachment-renamer-label" })
		this.dstEl = dst.createEl("td", { text: this.originalVal })
	}

	private buildInputComponents(el: HTMLElement) {
		this.textComp = new TextComponent(el).setValue(this.originalVal).onChange(async (value) => {
			this.value = value
			this.isValid = isValidInput(value)
			await this.debounceUpdateUI(250)
		})
		this.textComp.inputEl.addClass("attachment-renamer-modal-input")
		this.textComp.inputEl.addEventListener("compositionstart", () => {
			this.composing = true
		})
		this.textComp.inputEl.addEventListener("compositionend", () => {
			this.composing = false
		})
		this.textComp.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !this.composing) {
				e.preventDefault()
				this.accept()
			}
		})
		this.textComp.inputEl.select()

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

		this.loadingSpinner = buttonContainer.createDiv({ cls: "attachment-renamer-spinner" })
		this.loadingSpinner.hide()

		this.renameButton = new ButtonComponent(buttonContainer)
			.setButtonText("Rename")
			.setCta()
			.onClick(() => this.accept())
		new ButtonComponent(buttonContainer).setButtonText("Skip").onClick(() => {
			this.skipRename = true
			this.close()
		})
		new ButtonComponent(buttonContainer).setButtonText("Reset").onClick(async () => await this.resetUI())
		new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => this.close())
	}

	private async debounceUpdateUI(ms?: number) {
		clearTimeout(this.tid)
		if (this.isValid && ms) {
			this.loadingSpinner?.show()
			this.tid = setTimeout(() => {
				this.loadingSpinner?.hide()
				this.updateDstEl().catch((e) => console.error(e))
			}, ms)
		} else {
			await this.updateDstEl()
			this.loadingSpinner?.hide()
		}
		this.updateUI()
	}

	private updateUI() {
		if (!this.isValid) {
			this.textComp?.inputEl.addClass("attachment-renamer-error-textbox")
			this.renameButton?.setDisabled(true)
			return
		}

		this.textComp?.inputEl.removeClass("attachment-renamer-error-textbox")
		this.renameButton?.setDisabled(false)
	}

	private async updateDstEl() {
		if (!this.isValid) {
			this.dstEl?.setText("")
			return
		}

		const p = NaivePath.parse(this.value, this.src.extension)
		await p.updateCounter(this.app, this.settings)
		this.dstEl?.setText(p.renderPath(this.settings))
	}

	private async resetUI() {
		this.value = this.originalVal
		this.textComp?.setValue(this.value)
		await this.debounceUpdateUI()
		this.textComp?.inputEl.select()
	}
}
