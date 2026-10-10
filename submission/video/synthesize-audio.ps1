# Synthesize voiceover audio for SettleSight demo video
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
        id = "shot_01_hook"
        name = "Shot 1: The Hook"
        text = "Every month-end, small businesses spend painful hours matching PayPal transactions to invoices. SettleSight turns hours of spreadsheet chaos into minutes of automated clarity."
    },
    @{
        id = "shot_02_problem"
        name = "Shot 2: The Problem"
        text = "Here is the reality: PayPal deducts processing fees, buyers send partial milestone payments, one transfer covers two invoices, and clients forget invoice reference numbers. Standard accounting spreadsheets break, forcing sellers to manually calculate fees and guess which payment belongs to which invoice."
    },
    @{
        id = "shot_03_dashboard"
        name = "Shot 3: Live Demo - Dashboard and Auto-Match"
        text = "Meet SettleSight. Powered by AG Studio 3.0 and PayPal Developer APIs, it instantly pulls your PayPal Invoicing v2 records and Transaction Search feeds. Our deterministic match engine runs on integer cents, instantly auto-reconciling unambiguous payments with confidence 1.0. Notice our PayPal brand theme and the live Reconciliation Meter tracking our closing progress in real time."
    },
    @{
        id = "shot_04_exceptions"
        name = "Shot 4: Exceptions Queue Triage"
        text = "For complex transactions, the engine proposes scored candidates in the Exceptions Queue instead of guessing blindly. Here, it identifies a fee-adjusted transaction: gross deposit minus standard PayPal processing fees equals the net deposit. Below it, partial milestone installments and combined multi-invoice payments are categorized with transparent confidence scores."
    },
    @{
        id = "shot_05_agent"
        name = "Shot 5: Ask the Reconciliation Agent"
        text = "Need deeper insight? Our Reconciliation Auditor, built with AG Studio's Agent Framework, acts as your financial copilot. When we ask to audit partial payments and fee discrepancies, the agent executes client-side tools with visible audit badges, verifying fee formulas against standard merchant rates. The AI explains the exact reasoning in plain English before anything touches your ledger."
    },
    @{
        id = "shot_06_layout"
        name = "Shot 6: Layout Customization"
        text = "AG Studio gives merchants complete dashboard flexibility. With one click, we enter layout mode to reposition widgets or expand our custom Aging Distribution chart, highlighting overdue receivables across thirty, sixty, and ninety-day buckets. Every layout adjustment persists automatically to browser storage."
    },
    @{
        id = "shot_07_approve"
        name = "Shot 7: Approve with Validator"
        text = "Now, the seller takes action. When we click Approve in the Exceptions Queue, our invariant math validator ensures the allocation is strictly valid, preventing over-allocations, currency mismatches, or rounding drift. The Reconciliation Meter recalculates instantly, keeping the business owner firmly in control."
    },
    @{
        id = "shot_08_close"
        name = "Shot 8: Write-Back Confirm and Close"
        text = "Finally, SettleSight drafts polite customer reminders and writes confirmed payments back to PayPal Invoicing v2 when connected to live credentials, never mutating balances without seller approval. Zero manual spreadsheet formulas, zero guesswork, and deterministic mathematical accuracy. Reconcile your PayPal ledger today in seconds. Thank you!"
    }
)

$ffprobe = "D:\Hermes\tools\ffmpeg-9.0.1-win32-x64\bin\ffprobe.exe"
$results = @()
$totalDuration = 0.0

$titleDuration = 2.0
Write-Host "Title Card: $titleDuration seconds (silent)"
$totalDuration += $titleDuration

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
Write-Host ("Total Video Duration: {0:N2} seconds ({1:D2}:{2:D2})" -f $totalDuration, [int]($totalDuration / 60), [int]($totalDuration % 60))

$metaPath = Join-Path $audioDir "voiceover_timings.json"
$metadata = @{
    titleCardDuration = $titleDuration
    totalDuration = [Math]::Round($totalDuration, 2)
    voice = "Microsoft Zira Desktop"
    shots = $results
}
$metadata | ConvertTo-Json -Depth 4 | Set-Content $metaPath -Encoding UTF8
Write-Host "Saved timing metadata to $metaPath"
