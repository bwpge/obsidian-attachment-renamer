export const NAME_TEMPLATE_HELP = `
The name template is a string which describes how the name is generated using template variables.

## Syntax

- Use double or single braces to insert a variable: \`{ var }\`, \`{{ var }}\`, \`{{ var }\`, and \`{ var }}\` are all acceptable
- Whitespace inside the braces is ignored
- Use \`-\` before or after the variable name for conditional separators (See **Conditional separator** below for more information): \`{-header-}\`
- Paths are respected using \`/\` for path separators (see **Paths** below for more information)

Any other text is inserted as is, including invalid path characters

## Variables

The following variables can be used in the name template:

| Name | Description | Example |
|---|---|---|
| \`{noteName}\` | Name of the active note without extension | \`My Note\` |
| \`{noteParent}\` | Full path of the active note parent directory | \`Topic/Sub-Topic\` |
| \`{srcName}\` | Name of the original attachment without extension | \`Pasted image 20251201153340\` |
| \`{srcParent}\` | Full path of the original attachment parent directory | \`attachments\` |
| \`{extension}\` | Extension of the original attachment | \`png\` |
| \`{header}\` | Nearest previous heading relative to the cursor when pasting | \`My Introduction\` |
| \`{separator}\` | The separator string | \`-\` |
| \`{uuid}\` | Random identifier with the format \`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\` | \`da5bdb94-691f-4deb-aca8-0e4fdf6e903d\` |
| \`{DATE:FORMAT}\` | Used to format the current date. \`FORMAT\` must be a [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string, e.g. \`{{ DATE:YYYY-MM-DD }}\` | \`2025-12-01\` |
| \`{custom}\` | A custom value based on active note path (see **Folder template values** below for details) | \`...\` |

## Conditional separator

Use a \`-\` before or after variable names for conditional \`{separators}\`, e.g., \`{-header-}\`.

- If the variable has a non-empty value, the separator is inserted at the appropriate position
- If the value is empty, no separator is inserted

A common use case for this is with headers, where a value is not always available. Instead of having to manually delete a separator when no value is available, this will not insert it at all.

Example: \`{ header- }{ fileName }\`

- Produces \`My Header-My Note\` if a header is available
- Produces \`My Note\` otherwise

## Paths

>[!NOTE]
>Paths are relative to the vault root. Attachments cannot be moved outside the vault root directory.

You can directly edit the path in the rename box to move attachments to different directories. Note that \`/\` must be used as the path separator even on Windows.

- Empty and relative path segments are discarded: \`foo//./../bar\` is the same as \`foo/bar\`
- This allows using potentially empty variables for directories: \`{fileName}/{header}/{uuid}\`

>[!WARNING]
>By default, missing directories are not created before the attachment is moved/renamed. This is usually desired behavior, however there is no confirmation for which directories are created. Typos in an attachment path can create a mess of directories in your vault. Enable this setting only once you are comfortable with the template syntax.

## Folder template values

A folder template value allows you to assign a custom value for an attachment created in a note under that folder to be used with the \`{custom}\` template variable.

You can create a template value for any folder by right-clicking it in your explorer and clicking *Create folder template value*.

>[!NOTE]
>The most specific match is used as the \`{custom}\` value, ranked by the depth of folders in the match. So a match on \`foo\` is rank 1, the lowest priority, and the match \`foo/bar/baz\` is rank 3. The value for \`foo/bar/baz\` would be used for \`{custom}\`, even though \`foo\` also matched.

For example, if you wanted the prefix \`fbz\` to be used for all attachments created in a note under \`Foo/Bar/Baz\`, you can create a folder template value by right-clicking \`Baz\` in your explorer and setting the value to \`fbz\`.
`
