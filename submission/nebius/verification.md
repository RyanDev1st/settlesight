# Nebius video verification — 2026-10-11

Recorded from local Vite (`npm run dev`, port 5173) and the Node server (port 8787), using headless Microsoft Edge. The primary scene uses `DATA_SOURCE=demo` and `LLM_PROVIDER=nebius`: synthetic records with real Token Factory inference. Both dashboard badges say **Demo data · Nemotron Live**. The final data cut reloads the server in PayPal sandbox mode.

## Results from this recording

The [sanitized run log](run-log.json) is the source for [narration](narration.json) and [subtitles](subtitles.srt). No API credentials or private PayPal payer records are included.

| Action | Observed result |
| --- | --- |
| Click Run AI Triage (Nemotron) | `nvidia/nemotron-3-super-120b-a12b`; 16,789 ms; 8,306 total tokens. |
| Validate ranked items | 23 evaluated: 15 allocation proposals passed, 5 rejected, 3 ambiguity cases. |
| Approve `mat_26` | Synthetic recorded/reconciled value increased from $17,285.00 to $17,785.00; visible KPI change asserted. |
| Ask “Audit partial payments & fee discrepancies” | Nano selected `list_exceptions`; actual tool selection took 5,095 ms / 1,169 tokens; its follow-up took 18,074 ms / 5,416 tokens. |
| Switch to Live Sandbox | API reread returned 30 PayPal sandbox invoices. |
| Reread prior payment proof | SS-DEMO-028 (`INV2-C8Q2-3Y38-JVX8-WA85`) was `PARTIALLY_PAID`, with USD 25.00 paid and external payment record `EXTR-18338036U4388992R`. |

The five rejection cards show deterministic invariant failures, including requests against already settled invoice capacity. Three ambiguity cases are separate from allocation validation; “15 passed, 5 rejected” does not mean there were only 15 proposals in total. The recording makes one local synthetic approval and **no additional PayPal write**. The earlier confirmed sandbox payment request is documented in [live-verification.md](../../docs/live-verification.md).

## Media QC

Final application checks:

```text
npm test: # tests 80; # pass 80; # fail 0
npm run build: ✓ 61 modules transformed; ✓ built in 16.96s
```

The MP4 is `submission/nebius/settlesight-nebius.mp4` (gitignored). Final measurements and extraction timestamps are in [video-qc.json](video-qc.json).

```text
duration: 127.800000 seconds (2:07.8; below 165 and 170 seconds)
video: h264, 1920 × 1080, 10/1 fps
audio: aac, 96000 Hz, mono
mean_volume: -16.3 dB
max_volume: -1.2 dB
```

Six extracted frames were visually inspected for badges, model ID, real results, subtitle legibility, and payment proof:

1. [frame_1_overview.png](qc/frame_1_overview.png)
2. [frame_2_triage.png](qc/frame_2_triage.png)
3. [frame_3_validator.png](qc/frame_3_validator.png)
4. [frame_4_approved.png](qc/frame_4_approved.png)
5. [frame_5_agent.png](qc/frame_5_agent.png)
6. [frame_6_sandbox.png](qc/frame_6_sandbox.png)

Console capture in the run log contains AG Studio trial-license notices and zero “Fatal error” lines. Model waiting time is edited. The video uses genuine screenshots of the UI actions, held for generated narration; the sandbox proof card is a recording overlay built from the fresh API response. The agent's summary remains model-generated text, not a guarantee of accounting accuracy.

## Reproduce

Install dependencies and configure the local server credentials as described in the README. Do not run a separate server on port 8787 during capture.

```powershell
# Terminal 1
npm run dev
# Terminal 2, from the product root
node submission/video/build-video.mjs --nebius
```

The builder checks `FFMPEG_BIN` / `FFPROBE_BIN`, then the WinGet executable links, then PATH. Windows `System.Speech` supplies the English Microsoft Zira Desktop voice. The recorder selects demo data for the live AI segment and PayPal data for the sandbox segment without editing `.env`. It saves real model/usage/latency data before generating numbers in the narration.

To rebuild media from the saved run and screenshots without another API call:

```powershell
node submission/video/build-video.mjs --nebius --assemble-only
```

The screenshots and intermediate WAV/frame files are gitignored local build inputs. The narration manifest, subtitles, run log, QC JSON, and six QC PNGs are committed. YouTube upload and final Devpost submission remain pending (`YOUTUBE_URL_PENDING`).
