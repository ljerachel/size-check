(function () {
  if (window.__sizeSuggesterLoaded) return;
  window.__sizeSuggesterLoaded = true;

  const ALL_DIMS = ['bust', 'waist', 'hip', 'shoulder', 'sleeve', 'height'];

  const SIZE_KEYWORDS = /\b(xs|s|m|l|xl|xxl|xxxl|size|taille|größe)\b/i;
  const DIM_KEYWORDS = {
    bust:     /\b(bust|chest|poitrine|brust)\b/i,
    waist:    /\b(waist|taille)\b/i,
    hip:      /\b(hip|hips|hanches)\b/i,
    shoulder: /\b(shoulder|épaule|schulter)\b/i,
    sleeve:   /\b(sleeve|arm\s*length|manche|ärmellänge)\b/i,
    height:   /\b(height|stature|körpergröße)\b/i,
  };

  // ── Shared helpers ─────────────────────────────────────────────────────────

  function detectUnit(text) {
    if (/\bcm\b|\bcentim/i.test(text)) return 'cm';
    if (/\bin\b|\binch|\b"\b/i.test(text)) return 'in';
    return null;
  }

  function inferUnitFromValues(flatValues) {
    const nums = flatValues.filter(Boolean);
    if (!nums.length) return 'cm';
    const sorted = [...nums].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] > 50 ? 'cm' : 'in';
  }

  function parseCellText(text) {
    if (!text) return null;
    const rangeMatch = text.match(/(\d+\.?\d*)\s*[-–\/]\s*(\d+\.?\d*)/);
    if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
    const single = text.match(/^\s*(\d+\.?\d*)\s*$/);
    if (single) { const v = parseFloat(single[1]); return [v, v]; }
    return null;
  }

  function countDimMatches(text) {
    let n = 0;
    for (const re of Object.values(DIM_KEYWORDS)) if (re.test(text)) n++;
    return n;
  }

  function isProductPage() {
    return /add to (bag|cart|basket)|buy now/i.test(document.body.innerText);
  }

  // ── <table>-based detection ────────────────────────────────────────────────

  function scoreTable(table) {
    const text = table.innerText;
    let score = 0;
    if (SIZE_KEYWORDS.test(text)) score += 5;
    score += countDimMatches(text) * 3;
    if (/\b(xs|s|m|l|xl)\b/i.test(text)) score += 4;
    if (/\d{2,3}\s*[-–\/]\s*\d{2,3}/.test(text)) score += 3;
    return score;
  }

  function getCellRange(cell) { return parseCellText(cell.innerText.trim()); }

  function isTransposed(rows) {
    let n = 0;
    for (let r = 1; r < rows.length; r++) {
      const txt = rows[r].cells[0]?.innerText.trim() || '';
      for (const re of Object.values(DIM_KEYWORDS)) if (re.test(txt)) { n++; break; }
    }
    return n >= 2;
  }

  function parseStandardTable(rows) {
    const headers = Array.from(rows[0].cells).map(c => c.innerText.trim());
    const colMap = { label: -1 };
    ALL_DIMS.forEach(d => { colMap[d] = -1; });
    headers.forEach((h, i) => {
      if (SIZE_KEYWORDS.test(h) && colMap.label === -1) colMap.label = i;
      for (const dim of ALL_DIMS) if (DIM_KEYWORDS[dim].test(h) && colMap[dim] === -1) colMap[dim] = i;
    });
    if (colMap.label === -1) colMap.label = 0;

    const dataRows = [], allBustValues = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].cells);
      const entry = { label: cells[colMap.label]?.innerText.trim() || `Row ${r}` };
      for (const dim of ALL_DIMS) {
        if (colMap[dim] !== -1) {
          const range = getCellRange(cells[colMap[dim]]);
          if (range) { entry[dim] = range; if (dim === 'bust') allBustValues.push(...range); }
        }
      }
      dataRows.push(entry);
    }
    return { dataRows, allBustValues };
  }

  function parseTransposedTable(rows) {
    const headers = Array.from(rows[0].cells).map(c => c.innerText.trim());
    const dataRows = headers.slice(1).map(label => ({ label }));
    const allBustValues = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].cells);
      const dimLabel = cells[0]?.innerText.trim() || '';
      let matchedDim = null;
      for (const dim of ALL_DIMS) if (DIM_KEYWORDS[dim].test(dimLabel)) { matchedDim = dim; break; }
      if (!matchedDim) continue;
      for (let c = 1; c < cells.length && c - 1 < dataRows.length; c++) {
        const range = getCellRange(cells[c]);
        if (range) { dataRows[c - 1][matchedDim] = range; if (matchedDim === 'bust') allBustValues.push(...range); }
      }
    }
    return { dataRows, allBustValues };
  }

  function parseTable(table) {
    const rows = Array.from(table.rows);
    if (rows.length < 2) return null;
    const transposed = isTransposed(rows);
    const { dataRows, allBustValues } = transposed ? parseTransposedTable(rows) : parseStandardTable(rows);
    if (!dataRows.length) return null;
    const nearbyText = table.closest('section,div,dialog,article')?.innerText?.slice(0, 500) || '';
    const unit = detectUnit(table.innerText + nearbyText) || inferUnitFromValues(allBustValues);
    return { unit, rows: dataRows };
  }

  // ── Div/grid-based detection (React sites like Zara, H&M) ─────────────────

  function tryParseDivGrid(container) {
    let rows = Array.from(container.children).filter(el => el.children.length >= 2);
    if (rows.length < 3 && container.children.length === 1) {
      rows = Array.from(container.children[0].children).filter(el => el.children.length >= 2);
    }
    if (rows.length < 3) return null;

    const colCounts = rows.map(r => r.children.length);
    const median = [...colCounts].sort((a, b) => a - b)[Math.floor(colCounts.length / 2)];
    if (median < 2) return null;
    if (colCounts.filter(c => Math.abs(c - median) <= 1).length / colCounts.length < 0.6) return null;

    const grid = rows.map(row => Array.from(row.children).map(cell => cell.innerText.trim()));
    if (countDimMatches(grid.flat().join(' ')) < 1) return null;

    const isTransposedGrid = countDimMatches(grid.slice(1).map(r => r[0]).join(' ')) >= 1;
    const dataRows = [], allBustValues = [];

    if (isTransposedGrid) {
      const sizeLabels = grid[0].slice(1).filter(Boolean);
      if (!sizeLabels.length) return null;
      sizeLabels.forEach(label => dataRows.push({ label }));
      for (let r = 1; r < grid.length; r++) {
        let matchedDim = null;
        for (const dim of ALL_DIMS) if (DIM_KEYWORDS[dim].test(grid[r][0])) { matchedDim = dim; break; }
        if (!matchedDim) continue;
        for (let c = 1; c < grid[r].length && c - 1 < dataRows.length; c++) {
          const range = parseCellText(grid[r][c]);
          if (range) { dataRows[c - 1][matchedDim] = range; if (matchedDim === 'bust') allBustValues.push(...range); }
        }
      }
    } else {
      const colMap = { label: 0 };
      ALL_DIMS.forEach(d => { colMap[d] = -1; });
      grid[0].forEach((h, i) => { for (const dim of ALL_DIMS) if (DIM_KEYWORDS[dim].test(h) && colMap[dim] === -1) colMap[dim] = i; });
      for (let r = 1; r < grid.length; r++) {
        const entry = { label: grid[r][colMap.label] || `Row ${r}` };
        for (const dim of ALL_DIMS) {
          if (colMap[dim] !== -1) {
            const range = parseCellText(grid[r][colMap[dim]]);
            if (range) { entry[dim] = range; if (dim === 'bust') allBustValues.push(...range); }
          }
        }
        dataRows.push(entry);
      }
    }

    if (!dataRows.length || !dataRows.some(r => ALL_DIMS.some(d => r[d]))) return null;
    const unit = detectUnit(container.innerText) || inferUnitFromValues(allBustValues);
    return { unit, rows: dataRows };
  }

  function findDivChart() {
    const dialogCandidates = Array.from(document.querySelectorAll(
      'dialog[open], [role="dialog"], [aria-modal="true"]'
    )).filter(el => el.offsetParent !== null || el.tagName === 'DIALOG');

    for (const dialog of dialogCandidates) {
      const chart = tryParseDivGrid(dialog);
      if (chart) return chart;
      for (const el of dialog.querySelectorAll('ul, ol, [class*="table"], [class*="grid"], [class*="chart"], [class*="guide"], [class*="size"]')) {
        const chart = tryParseDivGrid(el);
        if (chart) return chart;
      }
    }

    const hinted = Array.from(document.querySelectorAll(
      '[class*="size"], [class*="guide"], [class*="chart"], [id*="size"], [id*="guide"]'
    )).filter(el => el.offsetParent !== null && countDimMatches(el.innerText) >= 2);

    for (const el of hinted) {
      const chart = tryParseDivGrid(el);
      if (chart) return chart;
    }
    return null;
  }

  function findBestChart() {
    const tables = Array.from(document.querySelectorAll('table'));
    const scored = tables.map(t => ({ table: t, score: scoreTable(t) }))
      .filter(x => x.score >= 3).sort((a, b) => b.score - a.score);
    if (scored.length) {
      const chart = parseTable(scored[0].table);
      if (chart) return chart;
    }
    return findDivChart();
  }

  // ── Auto-open size guide ───────────────────────────────────────────────────
  // Finds and clicks the "Size guide" button so the user never has to.

  function findSizeGuideButton() {
    for (const el of document.querySelectorAll('a, button, [role="button"], span')) {
      if (!el.offsetParent) continue;
      if (/size\s*(guide|chart|&\s*fit|info|help)?s?\s*$/i.test(el.innerText.trim()) ||
          /\bsize guide\b|\bsize chart\b/i.test(el.innerText)) {
        return el;
      }
    }
    return null;
  }

  function closeSizeGuideModal() {
    // Try the close button inside any open dialog first
    const closeBtn = document.querySelector(
      '[role="dialog"] button[aria-label*="close" i], ' +
      '[role="dialog"] button[aria-label*="dismiss" i], ' +
      '[aria-modal="true"] button[aria-label*="close" i], ' +
      'dialog[open] button[aria-label*="close" i]'
    );
    if (closeBtn) { closeBtn.click(); return; }
    // Fall back to Escape key — works on virtually all modal implementations
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  // ── Injected cards ─────────────────────────────────────────────────────────

  function removeCard() { document.getElementById('__ss-card')?.remove(); }

  function injectNudgeCard() {
    removeCard();
    const card = document.createElement('div');
    card.id = '__ss-card';
    card.innerHTML = `
      <div class="__ss-header">
        <span class="__ss-title">Size Suggester</span>
        <button class="__ss-close" aria-label="Close">✕</button>
      </div>
      <div class="__ss-nudge">Open the size guide on this page to get your recommendation</div>
    `;
    card.querySelector('.__ss-close').addEventListener('click', () => { removeCard(); window.__ssDismissed = true; });
    document.body.appendChild(card);
  }

  function injectCard(label, caveats, hasDimData) {
    removeCard();
    const card = document.createElement('div');
    card.id = '__ss-card';

    const caveatHTML = caveats.length === 0
      ? `<span class="__ss-chip ${hasDimData ? '__ss-good' : ''}">${hasDimData ? 'great fit' : 'fit details unavailable'}</span>`
      : caveats.map(c => {
          const cls = /^(tight|narrow|short)/.test(c.tag) ? '__ss-chip __ss-tight' : '__ss-chip __ss-loose';
          return `<span class="${cls}" title="${c.detail}">${c.tag}</span>`;
        }).join('');

    card.innerHTML = `
      <div class="__ss-header">
        <span class="__ss-title">Size Suggester</span>
        <button class="__ss-close" aria-label="Close">✕</button>
      </div>
      <div class="__ss-size">${label}</div>
      <div class="__ss-caveats">${caveatHTML}</div>
    `;
    card.querySelector('.__ss-close').addEventListener('click', () => { removeCard(); window.__ssDismissed = true; });
    document.body.appendChild(card);
  }

  // ── Core logic ─────────────────────────────────────────────────────────────

  let guideClickAttempted = false;

  async function tryRun() {
    if (window.__ssDismissed) return;
    if (document.getElementById('__ss-card')) return;

    const data = await chrome.storage.local.get([...ALL_DIMS, 'unit']);
    const measurements = {};
    ALL_DIMS.forEach(d => { measurements[d] = data[d] || null; });
    if (!ALL_DIMS.some(d => measurements[d] != null)) return;

    let chart = findBestChart();

    // No chart visible yet — try clicking the size guide button automatically
    if (!chart && !guideClickAttempted && isProductPage()) {
      guideClickAttempted = true;
      const btn = findSizeGuideButton();
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 1500));
        chart = findBestChart();
        // Close the modal we opened — user only needs the card, not the modal
        if (chart) setTimeout(closeSizeGuideModal, 2000);
      }
    }

    if (!chart) {
      // Show a nudge only on clothing product pages
      if (isProductPage()) injectNudgeCard();
      return;
    }

    const best = pickSize(measurements, data.unit || 'cm', chart);
    if (!best) return;

    const caveats = buildCaveats(best.fitDetail, data.unit || 'cm');
    injectCard(best.label, caveats, Object.keys(best.fitDetail).length > 0);
  }

  // ── Always-on: run + watch DOM + SPA navigation ───────────────────────────

  tryRun();

  let lastUrl = location.href;
  let debounceTimer;

  function scheduleRun(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { if (!document.getElementById('__ss-card')) tryRun(); }, delay);
  }

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      window.__ssDismissed = false;
      guideClickAttempted = false;
      removeCard();
    }
    scheduleRun(600);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', () => scheduleRun(1200), { passive: true, capture: true });

  // ── Popup message handler ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SCRAPE_SIZE_CHART') {
      const chart = findBestChart();
      sendResponse(chart ? { found: true, chart } : { found: false, reason: 'No size chart detected.' });
    }
    if (msg.type === 'MEASUREMENTS_UPDATED') {
      window.__ssDismissed = false;
      guideClickAttempted = false;
      removeCard();
      tryRun();
    }
  });
})();
