# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository contains a single self-contained static mock-up: a fictional corporate treasury analytics platform, plus its companion user manual. There is no build system, package manager, or test runner — the deliverable is plain HTML/CSS/JS meant to be opened directly in a browser.

## Files

- `treasury-platform.html` — the platform mock-up ("TreasuryIQ"). A single HTML file with inline CSS and vanilla JS; no build step, no external JS dependencies, no server required. Charts are hand-drawn inline SVG generated from static sample data in the `<script>` block. Open it directly in a browser (`file://` works) to view it.
- `TREASURY-PLATFORM-MANUAL.md` — a client-facing manual explaining what each chart/insight on the platform means and how to act on it. Mirrors the platform's tab structure section by section. Source of truth for the manual's content.
- `TreasuryIQ-Manual.pdf` — a print-formatted PDF build of the manual (cover page, running footer with page numbers), generated from `TREASURY-PLATFORM-MANUAL.md` via a one-off HTML+Chromium print pipeline (not checked into this repo — see below). Regenerate it after editing the manual; don't hand-edit the PDF.

## Working here

- Keep the platform as a single dependency-free HTML file unless the user asks for a real backend/framework — the point of this repo is a portable mock-up, not a production app.
- All data in `treasury-platform.html` (balances, ratios, alerts, the "Southern Cross Retail Group Ltd" client) is fictional sample data for illustration. Don't replace it with anything implying it's a real client or real Westpac data without being asked.
- If a chart or metric is added or changed, update the corresponding section of `TREASURY-PLATFORM-MANUAL.md` to match — the manual is written to describe the platform exactly as it stands, not as a general treasury primer.
- `TREASURY-PLATFORM-MANUAL.md` is authored in plain CommonMark: every list (bulleted or numbered), including single-item lists, needs a blank line before it or python-markdown silently folds it into the preceding paragraph as literal text. Check for this after editing the manual before regenerating the PDF.
- To regenerate the PDF: convert the Markdown to HTML with Python's `markdown` package (`tables`, `sane_lists`, `fenced_code` extensions), wrap it in a print stylesheet (A4, cover page, brand-maroon section rules), and render with headless Chromium's `page.pdf()` (Playwright). This isn't wired up as a repo script — it was done ad hoc; recreate the build script if asked to regenerate.
- The page follows the project's data-visualization conventions: categorical colors in fixed slot order, diverging blue/red only for polarity (net position, budget variance), sequential blue for magnitude, and status colors (good/warning/serious/critical) always paired with an icon + text label, never color alone.
