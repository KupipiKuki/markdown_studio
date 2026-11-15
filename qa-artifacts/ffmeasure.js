const { firefox } = require('playwright');
(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('file:///C:/Git/markdown_studio/scripts/markdown-studio.html');
  await page.waitForSelector('#editor', { state: 'visible' });
  const longLine = 'The quick brown fox jumps over the lazy dog and keeps running far beyond the pane edge ';
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(i % 7 === 0 ? longLine.repeat(2) : `Line ${i + 1}: short`);
  await page.fill('#editor', lines.join('\n'));
  await page.evaluate(() => { const ed = document.getElementById('editor'); ed.scrollTop = 0; document.getElementById('lineNumbers').scrollTop = 0; });
  await page.click('#btnToggleWrap');
  await page.waitForTimeout(300);
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
      const editorAbsY = edRect.top + padTop + span.offsetTop - ed.scrollTop;
      const gutterAbsY = gRect.top + gPadTop + i * parseFloat(gCS.lineHeight) - gutter.scrollTop;
      samples.push({ line: n, editorSpanOffsetTop: span.offsetTop, editorY: Math.round(editorAbsY * 10) / 10, gutterY: Math.round(gutterAbsY * 10) / 10, driftPx: Math.round((gutterAbsY - editorAbsY) * 10) / 10 });
    }
    mirror.remove();
    return { samples, edLineH: edCS.lineHeight, gLineH: gCS.lineHeight, edClientTop: ed.clientTop, gClientTop: gutter.clientTop, edPadTop: edCS.paddingTop, edFont: edCS.fontSize, gFont: gCS.fontSize, edScrollTop: ed.scrollTop, gScrollTop: gutter.scrollTop, edBorderStyleBoxSizing: 'x' };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
