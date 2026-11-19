// Phase 4 remediation probe: trace readiness decisions in the theme race.
// Scratch diagnostic only; run with the probe-patched app in the working tree.
const { chromium } = require('@playwright/test');
const path = require('path');

const APP = 'file:///' + path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html').replace(/\\/g, '/');
const F = '```';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
  await page.goto(APP);
  await page.waitForSelector('#editor', { state: 'visible' });

  await page.evaluate(() => {
    window.__renderLog = [];
    window.__renderStarts = [];
    window.__exportBlobAt = null;
    const orig = (window.__origRender = window.mermaid.render.bind(window.mermaid));
    window.mermaid.render = async (id, code) => {
      if (String(code).includes('THEMERACE')) {
        const n = (window.__themeRaceCalls = (window.__themeRaceCalls || 0) + 1);
        const delayMs = n === 1 ? 1500 : 3000;
        window.__renderStarts.push({ n, startedAt: performance.now(), delay: delayMs });
        await new Promise((r) => setTimeout(r, delayMs));
        const out = await orig(id, code);
        window.__renderLog.push({ n, endedAt: performance.now() });
        return out;
      }
      return orig(id, code);
    };
    const origCreate = (window.__origCreateTheme = URL.createObjectURL.bind(URL));
    URL.createObjectURL = (b) => {
      if (b instanceof Blob && window.__exportBlobAt === null) window.__exportBlobAt = performance.now();
      return origCreate(b);
    };
  });

  const doc = '# Theme Race\n\n' + F + 'mermaid\nflowchart TD\n  A[THEMERACE alpha] --> B[THEMERACE beta]\n' + F + '\n';
  await page.evaluate((v) => {
    const ed = document.getElementById('editor');
    ed.value = v;
    ed.dispatchEvent(new Event('input'));
  }, doc);
  await page.waitForTimeout(250);

  await page.evaluate(() => document.getElementById('exportDropdown').classList.add('open'));
  await page.click('#btnExportHtml');
  await page.click('#btnThemeToggle');
  await page.waitForTimeout(12000);

  const state = await page.evaluate(() => ({
    events: window.__events || [],
    wrapLog: window.__wrapLog || [],
    rdy: window.__rdy || [],
    rdyDetail: window.__rdyDetail || [],
    renderStarts: window.__renderStarts,
    renderLog: window.__renderLog,
    exportBlobAt: window.__exportBlobAt,
    theme: document.documentElement.getAttribute('data-theme'),
  }));
  console.log(JSON.stringify(state, null, 1));
  await browser.close();
})();
