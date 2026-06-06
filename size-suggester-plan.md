# Size Suggester Chrome Extension — Prototype Plan

## Context

A Chrome extension prototype that, on any women's clothing product page, scrapes the visible size chart and suggests which size to buy based on your stored bust/waist/hip measurements — with caveats like "will be looser in the bust by 3cm." It's a demo prototype: no auth, no security hardening, no per-site adapters, just a generic table scanner that works on most retailer charts.

The repo is the official Chrome extension samples repo, so we'll build a new sample directory using `functional-samples/tutorial.custom-cursor` as the structural template (cleanest MV3 sample combining content script + popup + `chrome.storage`).

## Decisions

- **Scope:** women's tops/dresses only
- **UI:** popup only (click extension icon)
- **Detection:** auto-scan `<table>` elements for size-related keywords
- **Input:** inline in popup, with `chrome.storage.local` persistence
- **Measurements:** bust, waist, hip
- **Units:** user stores in their preferred unit (cm or in); scraped chart is auto-detected and converted to user's unit
- **Caveats:** short tag (e.g. "loose in bust") + numeric detail on hover (e.g. "3 cm room")

## Architecture

```
size-suggester/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js          ← measurements form, triggers scrape, renders suggestion
├── content.js        ← scans DOM for size tables, parses to JSON
└── sizing.js         ← pure functions: unit detection, matching, caveat generation
```

No service worker needed — popup talks to content script directly via `chrome.tabs.sendMessage` + `chrome.scripting.executeScript`.

## Component design

### `manifest.json`
- `manifest_version: 3`
- `permissions: ["activeTab", "scripting", "storage"]`
- `host_permissions: ["<all_urls>"]` (prototype — no need to scope)
- `action: { default_popup: "popup.html" }`
- No declared `content_scripts` — inject on-demand via `chrome.scripting.executeScript` so we don't run on every page

### `popup.html` + `popup.js`
- Form: three number inputs (bust / waist / hip) + unit radio (cm / in)
- "Find my size" button
- Results area: suggested size in large text, list of caveat chips (short tag, `title=` for numeric detail on hover)
- On open: load saved measurements from `chrome.storage.local`, hydrate form
- On input change: debounce save back to storage
- On click:
  1. `chrome.tabs.query({active:true, currentWindow:true})` → tabId
  2. `chrome.scripting.executeScript({target:{tabId}, files:["content.js"]})`
  3. `chrome.tabs.sendMessage(tabId, {type:"SCRAPE_SIZE_CHART"})`
  4. Receive parsed chart rows + unit → call `sizing.js` matcher → render

### `content.js`
Single function, runs once when injected:
- Listen for `SCRAPE_SIZE_CHART` message
- Collect all `<table>` elements (including those inside open modals/dialogs)
- For each table, compute a relevance score: count of keywords in headers + first column (`size`, `bust`, `chest`, `waist`, `hip`, `XS|S|M|L|XL|XXL`, numeric size labels)
- Pick highest-scoring table above a threshold; if none, return `{found:false}`
- Parse winning table: identify which column = size label, which = bust, waist, hip (by header text match)
- Each cell: detect numeric range (e.g. "82-86") or single value; capture unit hint from headers/cell text (`cm`, `in`, `"`, `inches`)
- Return `{found:true, unit:"cm"|"in", rows:[{label:"M", bust:[82,86], waist:[64,68], hip:[88,92]}, ...]}`

### `sizing.js` (pure utility, imported by popup.js)
- `convertUnit(value, from, to)` — cm↔in
- `pickSize(userMeasurements, userUnit, chart)`:
  - Convert chart to user's unit
  - For each row, compute fit per dimension: `inside-range`, `below-range`, `above-range`, plus gap distance
  - Score each row (prefer rows where most dimensions are inside-range; tiebreak by smallest total gap)
  - Return best row + per-dimension fit info
- `buildCaveats(fit)`:
  - For each dimension where user is below the row's range → "loose in {bust|waist|hip}", detail `"{gap} {unit} room"`
  - Above the range → "tight in {dimension}", detail `"needs {gap} {unit} more"`
  - Inside range → no caveat
  - Return array of `{tag, detail}`

## Matching algorithm

Given user `{bust, waist, hip}` in their unit and chart rows (converted to same unit):

1. For each row, for each dimension:
   - If `user < row.min`: fit = `LOOSE`, gap = `row.min - user`
   - If `user > row.max`: fit = `TIGHT`, gap = `user - row.max`
   - Else: fit = `OK`, gap = 0
2. Row score = (count of OK dimensions × 100) − (sum of gaps)
3. Pick max-score row. Ties → smaller-size wins (deterministic).

If a row's bust column is missing entirely, that dimension is ignored for that row.

## Unit detection (in `content.js`)

- Scan table headers + caption + nearby text for: `cm`, `centim`, `inch`, `in`, `"` → set chart unit
- If both appear, prefer `cm`
- If neither found, infer from value magnitudes: if median bust value > 50, assume cm; else inches

## Files to create

All new, under a new top-level directory `functional-samples/sample.size-suggester/`:
- `manifest.json`
- `popup.html`, `popup.css`, `popup.js`
- `content.js`
- `sizing.js`
- `images/` with placeholder 16/32/48/128 PNG icons (reuse from `tutorial.custom-cursor/images/`)
- `README.md` — install steps and how to demo

## Reference samples (templates, do not modify)

- `functional-samples/tutorial.custom-cursor/` — overall MV3 structure, storage pattern
- `api-samples/storage/stylizr/` — popup form ↔ `chrome.storage` patterns
- `functional-samples/reference.mv3-content-scripts/` — `chrome.scripting.executeScript` injection from popup

## Verification

Manual demo flow:
1. `chrome://extensions` → enable Developer mode → "Load unpacked" → select `functional-samples/sample.size-suggester/`
2. Open the popup, enter sample measurements (e.g. bust 86, waist 70, hip 94, cm), confirm they persist after closing/reopening
3. Visit a known retailer with an inline size chart (e.g. an ASOS or Uniqlo product page with the "Size guide" expanded). Try 3+ different sites.
4. Click extension → "Find my size" → expect a size label and 0–3 caveat chips
5. Hover a caveat chip → expect numeric detail in tooltip
6. Edge cases:
   - Page with no table → "No size chart found on this page"
   - Chart in inches when user is cm (or vice versa) → suggestion still reasonable
   - User measurements straddling two sizes → caveat should explain the trade-off
   - Very small/large measurements outside chart → returns closest row with "tight"/"loose" caveats

No automated tests for the prototype.
