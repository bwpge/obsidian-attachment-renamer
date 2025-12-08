param(
	[Parameter(Mandatory=$true, Position=0)]
	[string]$VaultPath
)

if (!(Test-Path "$VaultPath")) {
	Write-Error "vault path '$VaultPath' does not exist"
	exit 1
}

if (!(Test-Path $(Join-Path "$VaultPath" ".obsidian/plugins"))) {
	Write-Error "plugins directory in '$VaultPath' does not exist"
	exit 1
}

Write-Host "Installing obsidian-attachment-renamer plugin to '$VaultPath'"

$plug_path = $(Join-Path "$VaultPath" ".obsidian/plugins/obsidian-attachment-renamer")
Write-Host "[+] Ensure plugin directory exists: $plug_path"
$null = New-Item -Path "$plug_path" -ItemType Directory -Force

$tag_name = (Invoke-RestMethod "https://api.github.com/repos/bwpge/obsidian-attachment-renamer/releases/latest").tag_name
Write-Host "[+] Get latest release: $tag_name"

$file_list=@("main.js", "styles.css", "manifest.json")
foreach ($f in $file_list) {
	Write-Host "[+] Download plugin file: $f"
	$outfile = $(Join-Path "$plug_path" "$f")
	Invoke-WebRequest -OutFile "$outfile" -Uri "https://github.com/bwpge/obsidian-attachment-renamer/releases/download/$tag_name/$f"
}

Write-Host "Done!"
