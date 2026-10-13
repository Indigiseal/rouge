# tools/save-elevenlabs-key.ps1
# Saves an ElevenLabs API key to %USERPROFILE%\.elevenlabs\key.txt, outside
# the project, where tools/generate-death-sounds.mjs reads it.
#
# Copy the key first (ElevenLabs site: Profile -> API Keys), then run this. It
# takes the key from the clipboard - pasting into a hidden prompt was
# unreliable - and never prints it. Run it again to replace the key.

$key = (Get-Clipboard -Raw)
if ($key) { $key = $key.Trim() }

if (-not $key -or $key.Length -lt 20 -or $key -match '\s') {
    Write-Host "The clipboard does not hold an ElevenLabs key."
    Write-Host "Copy the key from the ElevenLabs website first, then run this again."
    exit 1
}

$dir = Join-Path $env:USERPROFILE ".elevenlabs"
New-Item -ItemType Directory -Force $dir | Out-Null
Set-Content -NoNewline -Path (Join-Path $dir "key.txt") -Value $key
Set-Clipboard -Value " "
Write-Host ("Saved ({0} characters). Clipboard cleared. You can close this tab." -f $key.Length)
