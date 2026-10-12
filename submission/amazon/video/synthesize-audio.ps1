# Synthesize voiceover audio for SettleSight Alexa+ demo video
param(
    [string]$BeforePercent = "forty-six point seven two percent",
    [string]$AfterPercent = "forty-nine point three five percent"
)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Zira Desktop")
$synth.Rate = 1

$audioDir = Join-Path $PSScriptRoot "audio"
if (-not (Test-Path $audioDir)) {
    New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
}

$shots = @(
    @{
        id = "shot_01_title"
        name = "Shot 1: Title Card"
        text = "SettleSight for Alexa Plus, a simulated web experience."
    },
    @{
        id = "shot_02_problem"
        name = "Shot 2: The Problem and Mode"
        text = "Every month-end, small businesses face painful hours matching PayPal transactions against open invoices, struggling with fee deductions and unlinked payments. We are in scripted demo mode; the live mode uses Nemotron function calling. All records here use synthetic data."
    },
    @{
        id = "shot_03_summary"
        name = "Shot 3: Month-end Summary"
        text = "Alexa, how is my month-end reconciliation? SettleSight queries the deterministic engine over Streamable HTTP. The visible trace records the reconciliation summary tool call, confirming that $BeforePercent is reconciled."
    },
    @{
        id = "shot_04_review"
        name = "Shot 4: Review Queue"
        text = "What needs my review? The agent calls list exceptions through MCP, highlighting candidate matches and ambiguities so the reviewer sees every flagged reason before taking action."
    },
    @{
        id = "shot_05_explain"
        name = "Shot 5: Explain INV-2026-016"
        text = "Why is invoice 2026-016 flagged? The explain match tool unpacks the fee-adjusted evidence, showing the gross deposit minus the PayPal fee, and recommending human verification."
    },
    @{
        id = "shot_06_approve"
        name = "Shot 6: Approve it"
        text = "Approve it. SettleSight calls approve match with confirm false, returning an explicit confirmation prompt. Nothing changes without an explicit yes, keeping financial control in human hands."
    },
    @{
        id = "shot_07_confirm"
        name = "Shot 7: Yes, Confirm"
        text = "Yes, confirm. With confirm set to true, the match is approved, and the reconciliation meter immediately advances from $BeforePercent to $AfterPercent in demo memory."
    },
    @{
        id = "shot_08_terminal"
        name = "Shot 8: MCP Server Validation"
        text = "Behind the browser, our standalone Model Context Protocol server negotiates protocol 2025-11-25 over Streamable HTTP, verified directly by the official MCP SDK test suite."
    },
    @{
        id = "shot_09_close"
        name = "Shot 9: Closing"
        text = "SettleSight brings conversational clarity and deterministic safety to month-end bookkeeping. Explore the code and documentation on GitHub. Thank you."
    }
)

function Find-Binary($envVar, $name) {
    $val = [System.Environment]::GetEnvironmentVariable($envVar)
    if ($val) { return $val }
    $winget = "C:\Users\admin\AppData\Local\Microsoft\WinGet\Links\$name.exe"
    if (Test-Path $winget) { return $winget }
    $hermes = "D:\Hermes\tools\ffmpeg-9.0.1-win32-x64\bin\$name.exe"
    if (Test-Path $hermes) { return $hermes }
    if (Get-Command $name -ErrorAction SilentlyContinue) { return $name }
    return $name
}

$ffmpeg = Find-Binary "FFMPEG_BIN" "ffmpeg"
$ffprobe = Find-Binary "FFPROBE_BIN" "ffprobe"
$results = @()
$totalDuration = 0.0

foreach ($shot in $shots) {
    $wavPath = Join-Path $audioDir "$($shot.id).wav"
    $synth.SetOutputToWaveFile($wavPath)
    $synth.Speak($shot.text)
    
    $durStr = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $wavPath
    $dur = [double]$durStr
    $totalDuration += $dur
    
    $results += [PSCustomObject]@{
        Id = $shot.id
        Name = $shot.name
        Text = $shot.text
        Duration = [Math]::Round($dur, 2)
        TotalElapsed = [Math]::Round($totalDuration, 2)
    }
}

$synth.Dispose()

Write-Host "`nVoiceover Synthesis Results:"
$results | Format-Table Id, Duration, TotalElapsed, Name -AutoSize
Write-Host ("Total Video Audio Duration: {0:N2} seconds ({1:D2}:{2:D2})" -f $totalDuration, [int]($totalDuration / 60), [int]($totalDuration % 60))

$metaPath = Join-Path $audioDir "voiceover_timings.json"
$metadata = @{
    totalDuration = [Math]::Round($totalDuration, 2)
    voice = "Microsoft Zira Desktop"
    shots = $results
}
[System.IO.File]::WriteAllText($metaPath, ($metadata | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Saved timing metadata to $metaPath"

# Generate concat_list.txt and master_audio.wav
$concatList = Join-Path $audioDir "concat_list.txt"
$lines = @()
foreach ($shot in $shots) {
    $lines += "file '$($shot.id).wav'"
}
$lines | Set-Content $concatList -Encoding ASCII

$masterAudio = Join-Path $audioDir "master_audio.wav"
& $ffmpeg -y -f concat -safe 0 -i $concatList -c:a pcm_s16le $masterAudio
Write-Host "Master audio generated at $masterAudio"
