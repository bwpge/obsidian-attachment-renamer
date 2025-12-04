import { App, ButtonComponent, Modal, TextComponent, TFile } from "obsidian"
import { NaivePath } from "./NaivePath"
import { isImageExt } from "./utils"

const INVALID_CHARS_REGEX = /[\\:*?"<>|]/gu

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

	constructor(app: App, args: RenameModalArgs) {
		super(app)
		this.src = NaivePath.parse(args.src)
		this.originalVal = args.dst
		this.value = args.dst
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

	async onClose() {
		const { contentEl } = this
		contentEl.empty()

		if (this.skipRename) {
			if (this.onSkip) {
				await this.onSkip()
			}
			return
		}
		if (this.acceptRename) {
			if (this.onAccept) {
				const p = NaivePath.parse(this.value, this.src.extension)
				await p.updateIncrement(this.app, this.settings)
				await this.onAccept(p.renderPath(this.settings))
			}
		} else {
			if (this.onCancel) {
				await this.onCancel()
			}
		}

		this.acceptRename = false
		this.skipRename = false
	}

	private async accept() {
		this.acceptRename = true
		this.close()
	}

	private buildPreviewContainer(el: HTMLElement) {
		const imgEl = el.createDiv({ cls: "attachment-renamer-preview" })
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
		this.textComp.inputEl.addEventListener("compositionstart", async () => {
			this.composing = true
		})
		this.textComp.inputEl.addEventListener("compositionend", async () => {
			this.composing = false
		})
		this.textComp.inputEl.addEventListener("keydown", async (e) => {
			if (e.key === "Enter" && !this.composing) {
				e.preventDefault()
				await this.accept()
			}
		})
		this.textComp.inputEl.select()

		const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" })
		const checkBoxLabel = buttonContainer.createEl("label", { cls: "mod-checkbox" })
		const checkBox = checkBoxLabel.createEl("input", { type: "checkbox" })
		checkBox.addEventListener("change", () => {
			if (this.onDontAskChanged) {
				this.onDontAskChanged(checkBox.checked)
			}
		})
		checkBoxLabel.appendText("Don't ask again")

		this.renameButton = new ButtonComponent(buttonContainer)
			.setButtonText("Rename")
			.setCta()
			.onClick(async () => await this.accept())
		new ButtonComponent(buttonContainer).setButtonText("Skip").onClick(async () => {
			this.skipRename = true
			this.close()
		})
		new ButtonComponent(buttonContainer).setButtonText("Reset").onClick(async () => await this.resetUI())
		new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => this.close())
	}

	private async debounceUpdateUI(ms?: number) {
		clearTimeout(this.tid)
		if (this.isValid && ms) {
			this.tid = setTimeout(async () => {
				await this.updateDstEl()
			}, ms)
		} else {
			await this.updateDstEl()
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
		await p.updateIncrement(this.app, this.settings)
		this.dstEl?.setText(p.renderPath(this.settings))
	}

	private async resetUI() {
		this.value = this.originalVal
		this.textComp?.setValue(this.value)
		await this.debounceUpdateUI()
		this.textComp?.inputEl.select()
	}
}

function isValidInput(input: string): boolean {
	return !(input === "" || input.endsWith("/") || input.match(INVALID_CHARS_REGEX))
}
