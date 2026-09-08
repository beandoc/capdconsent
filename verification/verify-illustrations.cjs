// Run with PLAYWRIGHT_MODULE and CHROME_PATH configured as in README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', offline: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);

    // Label readability must survive SVG scaling, translations and enlarged text.
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const language of ['en', 'hi', 'mr']) {
        await page.locator('#language').selectOption(language);
        for (const scale of [1, 1.375]) {
          await page.evaluate(scale => {
            state.scale = scale;
            document.documentElement.style.setProperty('--scale', scale);
          }, scale);
          for (let phase = 0; phase < 8; phase++) {
            await page.evaluate(phase => go(phase), phase);
            const failures = await page.evaluate(() => {
              const problems = [];
              if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflows');
              for (const label of document.querySelectorAll('.plate-legend li > span:last-child, .plate-notes')) {
                if (parseFloat(getComputedStyle(label).fontSize) < 14) problems.push('legend below 14px');
                if (label.scrollWidth > label.clientWidth + 1) problems.push('legend overflows');
              }
              for (const svg of document.querySelectorAll('.plate-svg')) {
                const bounds = svg.getBoundingClientRect();
                for (const item of svg.querySelectorAll('text, .annotation-badge')) {
                  const box = item.getBoundingClientRect();
                  if (box.left < bounds.left - 1 || box.right > bounds.right + 1 ||
                      box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1) {
                    problems.push(`clipped marker/text: ${item.textContent}`);
                  }
                }
              }
              const single = document.querySelector('.plate-single');
              if (single && single.firstElementChild.getBoundingClientRect().width < single.clientWidth - 1) {
                problems.push('single plate leaves an empty grid column');
              }
              return problems;
            });
            assert.deepEqual(failures, [], `${width}px / ${language} / ${scale} / phase ${phase}`);
          }
        }
      }
    }

    await page.locator('#language').selectOption('en');
    await page.evaluate(() => go(0));
    // The catheter callout must actually touch the rendered catheter path.
    const catheterDistance = await page.evaluate(() => {
      const dot = document.querySelector('[data-anchor="catheter"] .dot');
      const curve = document.querySelector('.plate-svg .route');
      let distance = Infinity;
      for (let at = 0; at <= curve.getTotalLength(); at += .25) {
        const point = curve.getPointAtLength(at);
        distance = Math.min(distance, Math.hypot(point.x - dot.cx.baseVal.value, point.y - dot.cy.baseVal.value));
      }
      return distance;
    });
    assert(catheterDistance < 1, 'Catheter callout misses the tube');

    await page.evaluate(() => go(1));
    const belt = await page.locator('[data-anchor="belt"]').evaluate(group => ({
      marker: group.querySelector('text').textContent,
      y: group.querySelector('.dot').cy.baseVal.value,
    }));
    assert.equal(belt.marker, '4');
    assert(belt.y > 250 && belt.y < 270, 'Belt callout points above the drawn belt');
    assert.match(await page.locator('.plate-legend li').nth(3).textContent(), /Belt line/);

    await page.evaluate(() => go(4));
    const connectionGap = await page.evaluate(() => {
      const inlet = document.querySelector('[data-flow="in"]');
      const outlet = document.querySelector('[data-flow="out"]');
      const end = inlet.getPointAtLength(inlet.getTotalLength());
      const start = outlet.getPointAtLength(0);
      const connector = [...document.querySelectorAll('.plate-svg g[transform]')]
        .find(group => group.getAttribute('transform').includes('rotate(28)'));
      const transform = connector.transform.baseVal.consolidate().matrix;
      const tip = new DOMPoint(0, 17).matrixTransform(transform);
      return Math.max(Math.hypot(end.x - start.x, end.y - start.y), Math.hypot(end.x - tip.x, end.y - tip.y));
    });
    assert(connectionGap < 1, 'Fluid paths must meet at the external connector');

    await page.evaluate(() => go(5));
    const fibers = await page.locator('.plate-svg').evaluate(svg => [...svg.children]
      .filter(node => node.tagName === 'g')
      .map(group => [...group.querySelectorAll('.healing-fiber')].filter(fiber => {
        // Fibers must be painted after the cuff, so the opaque cuff cannot hide them.
        const cuff = fiber.parentElement.querySelector('g[transform]');
        return Boolean(cuff.compareDocumentPosition(fiber) & Node.DOCUMENT_POSITION_FOLLOWING);
      }).length));
    assert.deepEqual(fibers, [0, 4, 9], 'Visible ingrowth must increase across the three stages');
    assert.equal(await page.locator('.plate-notes strong').first().evaluate(el => getComputedStyle(el).display), 'block');
    assert.deepEqual(errors, []);
    console.log('PASS: 144 illustration layouts, readable legends, no clipped markers, full-width single plates, corrected callouts, connected fluid paths and visible cuff healing.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
