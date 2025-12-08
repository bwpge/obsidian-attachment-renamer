#!/bin/sh

set -eo pipefail
vault_path="$1"

if [ -z "$vault_path" ]; then
        echo "error: vault path is required" >&2
        exit 1
fi

if [ ! -d "$vault_path" ]; then
    echo "error: vault path '$vault_path' does not exist" >&2
        exit 1
fi

if [ ! -d "${vault_path}/.obsidian/plugins" ]; then
        echo "error: plugins directory does not exist in vault path" >&2
        exit 1
fi

echo "Installing obsidian-attachment-renamer plugin to '$1'"

plug_path="${vault_path}/.obsidian/plugins/obsidian-attachment-renamer"
echo "[+] Ensure plugin directory exists: $plug_path"
mkdir -p "$plug_path"

tag_name="$(curl -fsSL 'https://api.github.com/repos/bwpge/obsidian-attachment-renamer/releases/latest' | grep tag_name | awk '{print $2}' | sed 's/[",]//g')"
if [ -z "$tag_name" ]; then
	echo "error: could not get latest release" >&2
	exit 1
fi
echo "[+] Get latest release: $tag_name"

file_list="main.js styles.css manifest.json"
for f in $file_list; do
	echo "[+] Download plugin file: $f"
	curl -fsSLO --output-dir "$plug_path" "https://github.com/bwpge/obsidian-attachment-renamer/releases/download/$tag_name/$f"
done

echo "Done!"
