# Blackboard Bulk Course Downloader

A Tampermonkey userscript that adds a download button to any Blackboard course content page. One click to bulk-download all files in the current folder and its subfolders.

Works with any university running Blackboard Learn.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Click **Raw** on `blackboard-download.user.js` above and copy all the content
3. Open Tampermonkey → **Create a new script**, clear the default content, paste and save

## Usage

Log in to Blackboard → navigate into any course content folder (URL contains `listContent.jsp`) → click **📥 一键下载** in the top-right corner.

The button only appears on content listing pages, not the course home page.

## Features

- Recursively scans subfolders in parallel
- Real-time progress shown on the button while scanning and downloading
- Real filenames from `Content-Disposition` headers, not Blackboard's internal `xid-XXXXXX` format
- Files from subfolders are prefixed with their path (e.g. `Week3 - Slides - lecture.pdf`)
- Files referenced from multiple folders are only downloaded once
- 3 concurrent downloads with auto-retry on failure

## Notes

- Files are saved to your browser's default download folder
- Only accesses files you already have permission to view — no auth bypass
- No obfuscation, no external requests
