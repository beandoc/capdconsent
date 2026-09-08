const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const assert = require('assert');

(async () => {
  console.log('Starting headless Chrome for Gallery Mobile Deep Interaction Test...');
  const chrome = exec('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9225 --window-size=390,844 --disable-gpu "http://localhost:8080/"');

  try {
    await new Promise(r => setTimeout(r, 1600));

    const pages = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9225/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = pages.find(p => p.url.includes('8080'));
    if (!target) throw new Error('Could not find simulation target on port 9225');

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

    console.log('--- 1. Go to Step 4 and open Gallery ---');
    await evaluate(`
      const s4 = document.querySelector('button[data-step="3"]');
      if (s4) s4.click();
    `);
    await new Promise(r => setTimeout(r, 400));
    await evaluate(`document.querySelector('.play-left button[data-action="gallery-prompt"]').click();`);
    await new Promise(r => setTimeout(r, 400));
    await evaluate(`document.querySelector('button[data-action="confirm-gallery"]').click();`);
    await new Promise(r => setTimeout(r, 500));

    // Verify step 1
    let gIndex = await evaluate(`state.galleryIndex`);
    assert.strictEqual(gIndex, 0, 'Initial gallery index must be 0');
    await takeScreenshot('test-mobile-gallery-step1.png');

    console.log('--- 2. Scroll middle details pane (.gallery-info) down ---');
    await evaluate(`
      const info = document.querySelector('.gallery-info');
      if (info) info.scrollTop = 300;
    `);
    await new Promise(r => setTimeout(r, 300));
    await takeScreenshot('test-mobile-gallery-scrolled.png');

    // Verify photo is still at top and not cut off!
    const photoRect = await evaluate(`
      const img = document.querySelector('#gallery-photo');
      const r = img.getBoundingClientRect();
      ({ top: r.top, bottom: r.bottom, height: r.height })
    `);
    console.log('Photo rect while info is scrolled:', photoRect);
    assert.ok(photoRect.top > 0, 'Photo must be visible within viewport');
    assert.ok(photoRect.height > 100, 'Photo must have full height, not cut off');

    // Verify Next button is still at bottom and visible!
    const nextBtnRect = await evaluate(`(() => {
      const nb = document.querySelector('#gallery-next');
      const r = nb.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, isVisible: r.bottom <= 844 && r.top > 0 };
    })()`);
    console.log('Next button rect while info is scrolled:', nextBtnRect);
    assert.strictEqual(nextBtnRect.isVisible, true, 'Next button must be visible at bottom without scrolling');

    console.log('--- 3. Tap Next Button (#gallery-next) -> Step 2 ---');
    await evaluate(`document.querySelector('#gallery-next').click();`);
    await new Promise(r => setTimeout(r, 400));
    gIndex = await evaluate(`state.galleryIndex`);
    assert.strictEqual(gIndex, 1, 'Gallery index should advance to 1');

    // Verify info scroll was automatically reset to 0
    const infoScrollTop = await evaluate(`document.querySelector('.gallery-info').scrollTop`);
    assert.strictEqual(infoScrollTop, 0, 'Info scroll must be reset to 0 on step change');
    await takeScreenshot('test-mobile-gallery-step2.png');

    console.log('--- 4. Tap on-photo touch arrow (#gallery-photo-next) -> Step 3 ---');
    await evaluate(`document.querySelector('#gallery-photo-next').click();`);
    await new Promise(r => setTimeout(r, 400));
    gIndex = await evaluate(`state.galleryIndex`);
    assert.strictEqual(gIndex, 2, 'Gallery index should advance to 2 via on-photo arrow');
    await takeScreenshot('test-mobile-gallery-step3.png');

    console.log('--- 5. Test Touch Swipe Left on photo -> Step 4 ---');
    // Simulate touchstart and touchend with diffX = -80 (swipe left)
    await evaluate(`
      const frame = document.querySelector('#gallery-frame');
      const tStart = new Touch({ identifier: 1, target: frame, clientX: 250, clientY: 150, screenX: 250, screenY: 150 });
      const tEnd = new Touch({ identifier: 1, target: frame, clientX: 150, clientY: 152, screenX: 150, screenY: 152 });
      
      const touchStartEvt = new TouchEvent('touchstart', { touches: [tStart], targetTouches: [tStart], changedTouches: [tStart], bubbles: true });
      const touchEndEvt = new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [tEnd], bubbles: true });
      
      frame.dispatchEvent(touchStartEvt);
      frame.dispatchEvent(touchEndEvt);
    `);
    await new Promise(r => setTimeout(r, 500));
    gIndex = await evaluate(`state.galleryIndex`);
    assert.strictEqual(gIndex, 3, 'Gallery index should advance to 3 via swipe left');
    await takeScreenshot('test-mobile-gallery-step4-swipe.png');

    console.log('--- 6. Test Step 10 (Final Clinical Photo) ---');
    await evaluate(`document.querySelector('[data-gallery-step="9"]').click();`);
    await new Promise(r => setTimeout(r, 500));
    gIndex = await evaluate(`state.galleryIndex`);
    assert.strictEqual(gIndex, 9, 'Gallery index should jump to step 10 (index 9)');
    
    const nextDisabled = await evaluate(`document.querySelector('#gallery-next').disabled`);
    assert.strictEqual(nextDisabled, true, 'Next button should be disabled on last step');
    const photoNextDisabled = await evaluate(`document.querySelector('#gallery-photo-next').disabled`);
    assert.strictEqual(photoNextDisabled, true, 'Photo next arrow should be disabled on last step');

    await takeScreenshot('test-mobile-gallery-step10.png');

    console.log('\n===========================================');
    console.log('ALL GALLERY MOBILE INTERACTION TESTS PASSED!');
    console.log('===========================================');

    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
