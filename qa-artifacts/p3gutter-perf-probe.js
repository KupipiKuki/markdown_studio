// P3 review remediation probe: gutter row-offset pass benchmarks (old vs new
// lookup strategy) + end-to-end input handler timing on a 2000-line document.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('file:///C:/Git/markdown_studio/scripts/markdown-studio.html');
  await page.waitForSelector('#editor', { state: 'visible' });

  const lines = [];
  const para = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud ';
  for (let i = 0; i < 2000; i++) lines.push(i % 5 === 0 ? `${i + 1}. ${para}` : `Line ${i + 1}: short text`);
  const doc = lines.join('\n');

  await page.evaluate((v) => {
    const ed = document.getElementById('editor');
    ed.value = v;
    ed.dispatchEvent(new Event('input'));
  }, doc);
  await page.waitForTimeout(500);

  const res = await page.evaluate((lineTexts) => {
    const gutter = document.getElementById('lineNumbers');
    const ed = document.getElementById('editor');
    const gutterPadTop = 16, pitch = 21.6;
    const edCS = getComputedStyle(ed);
    const padL = parseFloat(edCS.paddingLeft), padR = parseFloat(edCS.paddingRight);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function buildMirror(withAttr) {
      const mirror = document.createElement('div');
      mirror.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;' +
        'font-family:' + edCS.fontFamily + ';font-size:' + edCS.fontSize + ';' +
        'line-height:' + edCS.lineHeight + ';white-space:' + edCS.whiteSpace + ';' +
        'word-break:' + edCS.wordBreak + ';overflow-wrap:' + edCS.overflowWrap + ';' +
        'tab-size:' + edCS.tabSize + ';box-sizing:content-box;padding:0;margin:0;border:0;' +
        'width:' + (ed.clientWidth - padL - padR) + 'px;';
      let mhtml = '';
      for (let i = 0; i < lineTexts.length; i++) {
        mhtml += (i ? '\n' : '') + '<span' + (withAttr ? ' data-ln="' + i + '"' : '') + '>' + esc(lineTexts[i]) + '</span>';
      }
      mirror.innerHTML = mhtml;
      document.body.appendChild(mirror);
      return mirror;
    }

    function emit(spans, lookup, mirror) {
      let html = '';
      let lastRowTop = 0;
      for (let i = 0; i < spans.length; i++) {
        const span = lookup(mirror, i);
        const rowTop = span ? span.offsetTop : i * pitch;
        lastRowTop = rowTop;
        html += '<span style="position:absolute;top:' + (gutterPadTop + rowTop) + 'px;right:8px;">' + (i + 1) + '</span>';
      }
      html += '<span style="position:absolute;top:' + (gutterPadTop + lastRowTop + pitch + 16) + 'px;width:1px;height:1px;"></span>';
      gutter.innerHTML = html;
    }

    const mA = buildMirror(false), mQ = buildMirror(true);
    const childrenMs = [], queryMs = [], inputHandlerMs = [];
    for (let run = 0; run < 10; run++) {
      let t = performance.now();
      emit(mA.children, (m, i) => m.children[i], mA);
      childrenMs.push(performance.now() - t);
      t = performance.now();
      emit(mQ.children, (m, i) => m.querySelector('[data-ln="' + i + '"]'), mQ);
      queryMs.push(performance.now() - t);
    }
    mA.remove(); mQ.remove();

    for (let run = 0; run < 5; run++) {
      const t = performance.now();
      ed.dispatchEvent(new Event('input'));
      inputHandlerMs.push(performance.now() - t);
    }

    const med = (a) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)] * 10) / 10; };
    const min = (a) => Math.round(Math.min(...a) * 10) / 10;
    const max = (a) => Math.round(Math.max(...a) * 10) / 10;
    return {
      lineCount: lineTexts.length,
      childrenLookup: { min: min(childrenMs), median: med(childrenMs), max: max(childrenMs) },
      perLineQuerySelector: { min: min(queryMs), median: med(queryMs), max: max(queryMs) },
      inputHandler: { min: min(inputHandlerMs), median: med(inputHandlerMs), max: max(inputHandlerMs) },
    };
  }, lines);
  console.log(JSON.stringify(res));
  await browser.close();
})();
