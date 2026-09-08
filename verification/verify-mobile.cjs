const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('Starting headless Chrome for mobile viewport verification...');
  const chrome = exec('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9224 --window-size=390,844 --disable-gpu "http://localhost:8080/"');

  try {
    await new Promise(r => setTimeout(r, 1600));

    // Get pages from CDP on port 9224
    const pages = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9224/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = pages.find(p => p.url.includes('8080'));
    if (!target) throw new Error('Could not find simulation target on port 9224');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = evt => {
      const msg = JSON.parse(evt.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      const id = msgId++;
      return new Promise(resolve => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval failed for: ${expr}`);
      }
      return res.result && res.result.result ? res.result.result.value : undefined;
    };

    const takeScreenshot = async (name) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.result.data, 'base64');
      fs.writeFileSync(name, buffer);
      console.log(`Saved screenshot: ${name}`);
    };

    console.log('--- Test 1: Mobile Main Page (390 x 844) ---');
    await new Promise(r => setTimeout(r, 600));
    const teamBtnVisible = await evaluate(`
      const b = document.querySelector('.top-actions > .team-btn');
      b && getComputedStyle(b).display !== 'none'
    `);
    assert.strictEqual(teamBtnVisible, true, 'Team button should be accessible on mobile topbar');
    await takeScreenshot('audit-mobile-opt-main.png');

    console.log('--- Test 2: Mobile Step 4 Restructured Controls ---');
    await evaluate(`
      const step4Btn = document.querySelector('button[data-step="3"]');
      if (step4Btn) step4Btn.click();
    `);
    await new Promise(r => setTimeout(r, 500));
    const step4Heading = await evaluate(`document.querySelector('#phase-title').textContent`);
    console.log(`Step 4 Title: ${step4Heading}`);
    await takeScreenshot('audit-mobile-opt-step4.png');

    console.log('--- Test 3: Consent Companion Mobile Sheet ---');
    await evaluate(`
      const consentBtn = document.querySelector('.play-left button[data-action="consent-tool"]');
      if (consentBtn) consentBtn.click();
    `);
    await new Promise(r => setTimeout(r, 600));
    const dialogDisplay = await evaluate(`
      const d = document.querySelector('#modal');
      const s = getComputedStyle(d);
      s.display === 'flex' && s.position === 'fixed'
    `);
    assert.strictEqual(dialogDisplay, true, 'Modal should be styled as flex fixed sheet on mobile');
    await takeScreenshot('audit-mobile-opt-consent.png');

    console.log('--- Test 4: Consent Declarations (Module 6) ---');
    await evaluate(`
      const declTab = document.querySelector('.consent-step-btn[data-consent-step="5"]');
      if (declTab) declTab.click();
    `);
    await new Promise(r => setTimeout(r, 600));
    const inputFontSize = await evaluate(`
      const inp = document.querySelector('#consent-input-name');
      getComputedStyle(inp).fontSize
    `);
    console.log(`Input font-size on mobile: ${inputFontSize}`);
    assert.strictEqual(inputFontSize, '16px', 'Input font-size must be 16px to prevent iOS Safari auto-zoom');
    await takeScreenshot('audit-mobile-opt-declarations.png');

    console.log('--- Test 5: Close Modal & Open Clinical Gallery ---');
    await evaluate(`document.querySelector('#close-modal').click();`);
    await new Promise(r => setTimeout(r, 400));
    // Click gallery prompt button
    await evaluate(`document.querySelector('.play-left button[data-action="gallery-prompt"]').click();`);
    await new Promise(r => setTimeout(r, 500));
    // Confirm sensitive notice
    await evaluate(`document.querySelector('button[data-action="confirm-gallery"]').click();`);
    await new Promise(r => setTimeout(r, 600));
    await takeScreenshot('audit-mobile-opt-gallery.png');

    console.log('--- Test 6: Extreme Narrow Screen (360 x 780) ---');
    await evaluate(`document.querySelector('button[data-action="close"]').click();`);
    await new Promise(r => setTimeout(r, 400));
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 780,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot('audit-mobile-opt-narrow360.png');

    console.log('\n===========================================');
    console.log('ALL MOBILE VIEWPORT AUDITS PASSED WITH SUCCESS!');
    console.log('===========================================');

    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
