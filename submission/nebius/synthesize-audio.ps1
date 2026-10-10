param([Parameter(Mandatory=$true)][string]$Directory, [Parameter(Mandatory=$true)][string]$Ffprobe)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Zira Desktop')
$voice.Rate = 1
$shots = Get-Content -LiteralPath (Join-Path $Directory 'narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($shot in $shots) {
  $file = Join-Path $Directory ('audio/' + $shot.id + '.wav')
  $voice.SetOutputToWaveFile($file)
  $voice.Speak($shot.text)
  $voice.SetOutputToNull()
  $duration = & $Ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $file
  $shot | Add-Member -NotePropertyName duration -NotePropertyValue ([double]::Parse($duration, [cultureinfo]::InvariantCulture))
}
$voice.Dispose()
[System.IO.File]::WriteAllText((Join-Path $Directory 'audio/timings.json'), ($shots | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
