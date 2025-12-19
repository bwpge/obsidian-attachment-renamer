# Attachment Renamer

This plugin was originally a fork of [reorx/obsidian-paste-image-rename](https://github.com/reorx/obsidian-paste-image-rename), but has turned into a full rewrite from the ground up. Paste image rename is a great plugin, but it seems development has paused on enhancements for the time being.

My goal with this plugin is to bring forward the core features of Paste image rename while implementing missing features.

## Features and improvements

- Rename dialog box improvements
	- **Reset** and **Skip** buttons
    - **Don't ask again** checkbox
	- Show preview with counter when input changes
	- Open with text pre-selected
	- Edit full path to adjust parent or create subdirectories (with option to create missing directories)
- Overhaul of templates:
	- Use single or double braces to cut down on noise
	- Ignore whitespace inside `{...}`
	- `{header}` template variable for closest previous header
	- `{uuid}` template variable
	- Conditional separators with `{-var}`/`{var-}` notation
	- `{custom}` values based on active note path
- Quality of life options:
	- Template preview in settings tab
	- Option to delete attachments when rename dialog is cancelled
	- Padding option for attachment counters (e.g., `001`)
	- Space replacement in names
	- Transform attachment name to upper/lowercase
	- Use multiple regular expressions for ignoring attachments
	- Match ignore patterns to full path, not just extension

## Installation

Until this plugin is approved by Obsidian, you will have to manually install it.

- Create the plugin folder in your vault: `your-vault/.obsidian/plugins/obsidian-attachment-renamer`
- Download `main.js`, `styles.css`, and `manifest.json` from the latest release into the plugin folder
- Restart Obsidian and enable the plugin

Scripts are provided for convenience, use at your own risk. They have been minimally tested.

### Windows

Download `scripts/install.ps1` and run with:

```powershell
./install.ps1 -VaultPath path\to\your\vault

```

### Linux/macOS

Download `scripts/install.sh` and run with:

```sh
sh ./install.sh path/to/your/vault
```

## Usage

### Rename attachments

You can paste or drag and drop any attachment (image or otherwise) into your note to trigger the **Rename attachment** dialog.

<img width="820" height="604" src="https://github.com/user-attachments/assets/9c56a0d8-54c8-4c98-9071-a0a82f5c8de7" />

The default template `{srcParent}/{custom-}{noteName}` generates the value `attachments/Example`:

- `{srcParent}/`: use the same parent as where the attachment was created (e.g., `attachments`) followed by a `/`
- `{custom-}`: use the folder template value, and if non-empty, insert a `{separator}` after it
- `{noteName}`: the name of the note the attachment was created in (e.g., `Example`)

By adjusting a few settings, you can achieve different styles such as attachment "slugs":

<img width="823" height="605" src="https://github.com/user-attachments/assets/b2a2a2d2-f673-4c0d-be46-87eedb8be298" />

The same goes for non-image attachments:

<img width="824" height="325" src="https://github.com/user-attachments/assets/8eb10f0b-b126-40e5-8dff-8ff82977ec5e" />

### Folder template values

You can create a template value for any folder by right-clicking it in your explorer and clicking *Create folder template value*:

<img width="245" height="149" src="https://github.com/user-attachments/assets/bda11238-4a25-4a92-a639-c7310b7363f9" />

You can set the value in the dialog:

<img width="570" height="286" src="https://github.com/user-attachments/assets/be847645-c92f-42b3-8409-b1f1ba1aeb29" />

And now that value is used as `{custom}` when the active note is located under that folder:

<img width="481" height="111" src="https://github.com/user-attachments/assets/a29a287b-f534-48c0-ae59-60ebb6a026c9" />

You can view and manage these values in the settings tab as well:

<img width="571" height="161" src="https://github.com/user-attachments/assets/6d2acaf5-cce4-4d8b-b1ea-83d54dcd886a" />

See [Folder template values](#folder-template-values) below for details.

## Configuration

The default configuration is meant to be the least intrusive for a new plugin. Any settings that touch the filesystem without confirmation are disabled.

Once you are familiar with the plugin, it is strongly recommended to enable **Delete attachments if cancelled** and **Create missing directories**.

| Setting | Description |
|---|---|
| Name template | A template string which controls how the attachment path is generated. See [Name template](#name-template) below for more details. |
| Folder template values | Sets the `{custom}` template variable based on the active note path when an attachment is created. |
| Create missing directories | Create all missing intermediate directories when renaming an attachment. For example, given the parent folder `attachments`, a path of `attachments/foo/bar/baz.png` would create `foo` and `bar`, then move `baz.png` into `bar`. |
| Delete attachments if cancelled | Delete attachments if the rename box is cancelled (e.g., with Esc key or Cancel button). To keep the original name with this setting on, use the **Skip** button. |
| Confirm individual attachment rename | Ask before renaming an individual attachment. |
| Confirm when renaming all attachments | Ask before renaming all attachments in the active note (triggered by command or hotkey). |
| Always number attachments | Rename all attachments with a counter e.g., `foo-1`. Otherwise, only use a counter when the attachment name already exists. |
| Number padding | Minimum number of digits an attachment number must have. For example, a value of 3 will result in 001, 042, 1000, etc. |
| Separator | Value used to separate different template values such as name and attachment counters, e.g., foo-02. |
| Space replacement | Use `none` to replace spaces with an empty string. Leave empty to disable. |
| Transform name | Change the attachment name to uppercase or lowercase. |
| Ignore patterns | Skip processing attachments whose path matches any provided regular expression. The full path is tested, including attachment extension. Each line is treated as a separate regular expression. Empty lines are ignored. |

## Name template

The name template is a string which describes how the name is generated using template variables.

### Syntax

- Use double or single braces to insert a variable: `{ var }`, `{{ var }}`, `{{ var }`, and `{ var }}` are all acceptable
- Whitespace inside the braces is ignored
- Use `-` before or after the variable name for conditional separators (See [Conditional separator](#conditional-separator) below for more information): `{-header-}`
- Paths are respected using `/` for path separators (see [Paths](#paths) below for more information)

Any other text is inserted as is, including invalid path characters.

### Variables

The following variables can be used in the name template:

| Name | Description | Example |
|---|---|---|
| `{noteName}` | Name of the active note without extension | `My Note` |
| `{noteParent}` | Full path of the active note parent directory | `Topic/Sub-Topic` |
| `{srcName}` | Name of the original attachment without extension | `Pasted image 20251201153340` |
| `{srcParent}` | Full path of the original attachment parent directory | `attachments` |
| `{extension}` | Extension of the original attachment | `png` |
| `{header}` | Nearest previous heading relative to the cursor when pasting | `My Introduction` |
| `{separator}` | The separator string | `-` |
| `{uuid}` | Random identifier with the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `da5bdb94-691f-4deb-aca8-0e4fdf6e903d` |
| `{DATE:FORMAT}` | Used to format the current date. `FORMAT` must be a [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string, e.g. `{{ DATE:YYYY-MM-DD }}` | `2025-12-01` |
| `{custom}` | A custom value based on active note path (see [Folder template values](#folder-template-values) below for details) | `...` |

#### Conditional separator

Use a `-` before or after variable names for conditional `{separators}`, e.g., `{-header-}`.

- If the variable has a non-empty value, the separator is inserted at the appropriate position
- If the value is empty, no separator is inserted

A common use case for this is with headers, where a value is not always available. Instead of having to manually delete a separator when no value is available, this will not insert it at all.

Example: `{header-}{fileName}`

- Produces `My Header-My Note` if a header is available
- Produces `My Note` otherwise

### Paths

>[!NOTE]
>Paths are relative to the vault root. Attachments cannot be moved outside the vault root directory.

You can directly edit the path in the rename box to move attachments to different directories. Note that `/` must be used as the path separator even on Windows.

- Empty and relative path segments are discarded: `foo//./../bar` is the same as `foo/bar`
- This allows using potentially empty variables for directories: `{fileName}/{header}/{uuid}`

>[!WARNING]
>By default, missing directories are not created before the attachment is moved/renamed. This is usually desired behavior, however there is no confirmation for which directories are created. Typos in an attachment path can create a mess of directories in your vault. Enable this setting only once you are comfortable with the template syntax.

### Folder template values

A folder template value allows you to assign a custom value for an attachment created in a note under that folder to be used with the `{custom}` template variable.

You can create a template value for any folder by right-clicking it in your explorer and clicking *Create folder template value*.

>[!NOTE]
>The most specific match is used as the `{custom}` value, ranked by the depth of folders in the match. So a match on `foo` is rank 1, the lowest priority, and the match `foo/bar/baz` is rank 3. The value for `foo/bar/baz` would be used for `{custom}`, even though `foo` also matched.

For example, if you wanted the prefix `fbz` to be used for all attachments created in a note under `Foo/Bar/Baz`, you can create a folder template value by right-clicking `Baz` in your explorer and setting the value to `fbz`. You can then use `{custom-}` in your template to create a value followed by `{separator}`.

## Acknowledgements

This plugin is based on the great work of several other popular projects:

- [reorx/obsidian-paste-image-rename](https://github.com/reorx/obsidian-paste-image-rename): the main inspiration for this plugin
- [xRyul/obsidian-image-converter](https://github.com/xRyul/obsidian-image-converter): inspiration for many new features, such as better template syntax and preview in settings tab
- [Eldritch-Oliver/file-hider](https://github.com/Eldritch-Oliver/file-hider): copied their implementation for managing folder template values (right-click menu and settings UI)
