# Size Suggester

A Chrome extension prototype that scrapes size charts on clothing product pages and suggests your size based on your bust, waist, and hip measurements — with caveats like "loose in bust" or "tight in waist."

## Install

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory (`sample.size-suggester/`)

## How to use

1. Navigate to any women's clothing product page that has a visible size chart (inline table — open the size guide/chart modal first if it's hidden behind a button)
2. Click the extension icon
3. Enter your measurements (bust, waist, hip) and select your unit (cm or in)
4. Click **Find my size**

The extension scans all `<table>` elements on the page, picks the one most likely to be a size chart, and suggests the best-fitting size. Measurements persist between sessions.

## Caveat chips

- **Purple chip** — "loose in bust/waist/hip": your measurement is smaller than the chart row's minimum for that dimension. Hover for the exact gap.
- **Red chip** — "tight in bust/waist/hip": your measurement exceeds the chart row's maximum. Hover for how much more room you'd need.
- No chip = that dimension fits within the size range.

## Limitations (prototype)

- Only reads `<table>` elements — size charts built with CSS grids or divs won't be detected
- Works best when the size chart modal/popup is already open and visible on the page before clicking the extension
- Unit detection is heuristic; charts that mix cm and inches may be misread
