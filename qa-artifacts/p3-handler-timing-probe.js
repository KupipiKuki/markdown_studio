// Negative-control probe for remediation 2: times the app's REAL synchronous
// input handler (which includes updateLineNumbers) on a 2000-line document.
// Run inside a worktree: node handler-timing-probe.js <path-to-html>
const { chromium } = require('playwright');
(async () => {
  const target = process.argv[2] || 'C:/Git/markdown_studio/scripts/markdown-studio.html';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('file:///' + target.replace(/\\/g, '/'));
  await page.waitForSelector('#editor', { state: 'visible' });
  const lines = [];
  const para = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud ';
  for (let i = 0; i < 2000; i++) lines.push(i % 5 === 0 ? `${i + 1}. ${para}` : `Line ${i + 1}: short text`);
  await page.evaluate((v) => {
    const ed = document.getElementById('editor');
    ed.value = v;
    ed.dispatchEvent(new Event('input'));
  }, lines.join('\n'));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const ms = [];
    for (let i = 0; i < 12; i++) {
      const t = performance.now();
      ed.dispatchEvent(new Event('input'));
      ms.push(performance.now() - t);
    }
    const s = [...ms].sort((a, b) => a - b);
    return { min: +s[0].toFixed(1), median: +s[6].toFixed(1), max: +s[s.length - 1].toFixed(1) };
  });
  console.log('target:', target, JSON.stringify(r));
  await browser.close();
})();
