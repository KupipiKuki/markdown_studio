// Standalone gutter measurement dump (diagnostic + before/after evidence)
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.argv[2] || 'C:/Git/ms-p3-baseline/scripts/markdown-studio.html';
const URL = 'file:///' + BASE;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(URL);
  await page.waitForSelector('#editor', { state: 'visible' });

  const longLine = 'The quick brown fox jumps over the lazy dog and keeps running far beyond the pane edge ';
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(i % 7 === 0 ? longLine.repeat(2) : `Line ${i + 1}: short`);
  await page.fill('#editor', lines.join('\n'));
  await page.evaluate(() => { const ed = document.getElementById('editor'); ed.scrollTop = 0; document.getElementById('lineNumbers').scrollTop = 0; });
  await page.click('#btnToggleWrap'); // nowrap

  const out = await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const gutter = document.getElementById('lineNumbers');
    const edCS = getComputedStyle(ed);
    const gCS = getComputedStyle(gutter);
    const padTop = parseFloat(edCS.paddingTop);
    const padL = parseFloat(edCS.paddingLeft);
    const padR = parseFloat(edCS.paddingRight);
    const mirror = document.createElement('div');
    mirror.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;' +
      'font-family:' + edCS.fontFamily + ';font-size:' + edCS.fontSize + ';' +
      'line-height:' + edCS.lineHeight + ';white-space:' + edCS.whiteSpace + ';' +
      'word-break:' + edCS.wordBreak + ';overflow-wrap:' + edCS.overflowWrap + ';' +
      'tab-size:' + edCS.tabSize + ';box-sizing:content-box;padding:0;margin:0;border:0;' +
      'width:' + (ed.clientWidth - padL - padR) + 'px;';
    const content = ed.value.split('\n');
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = '';
    content.forEach((line, i) => { html += (i ? '\n' : '') + '<span data-ln="' + i + '">' + esc(line) + '</span>'; });
    mirror.innerHTML = html;
    document.body.appendChild(mirror);
    const edRect = ed.getBoundingClientRect();
    const gRect = gutter.getBoundingClientRect();
    const gPadTop = parseFloat(gCS.paddingTop);
    const samples = [];
    for (const n of [1, 5, 9, 15, 20, 25, 30, 35, 40]) {
      const i = n - 1;
      const span = mirror.querySelector('[data-ln="' + i + '"]');
      if (!span) continue;
      const editorAbsY = edRect.top + padTop + span.offsetTop - ed.scrollTop;
      const gutterAbsY = gRect.top + gPadTop + i * parseFloat(gCS.lineHeight) - gutter.scrollTop;
      samples.push({ line: n, gutterY: Math.round(gutterAbsY * 10) / 10, editorY: Math.round(editorAbsY * 10) / 10, driftPx: Math.round((gutterAbsY - editorAbsY) * 10) / 10 });
    }
    mirror.remove();
    return {
      samples,
      raw: {
        edRectTop: edRect.top, gRectTop: gRect.top,
        edPadTop: edCS.paddingTop, gPadTop: gCS.paddingTop, gPadBottom: gCS.paddingBottom,
        edScrollTop: ed.scrollTop, gScrollTop: gutter.scrollTop,
        edLineH: edCS.lineHeight, gLineH: gCS.lineHeight,
        edFont: edCS.fontSize, gFont: gCS.fontSize,
        edWhite: edCS.whiteSpace,
        edOffsetTop0: mirror.childNodes.length ? undefined : undefined,
        gutterTextLines: gutter.textContent.split('\n').length,
        gutterInlineSize: gutter.getBoundingClientRect().height,
      },
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
