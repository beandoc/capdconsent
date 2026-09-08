const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  const chrome = exec('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9222 --window-size=1440,1050 --disable-gpu "http://localhost:8080/"');
  
  try {
    await new Promise(r => setTimeout(r, 1500));
    
    // Get pages from CDP
    const pages = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    
    const target = pages.find(p => p.url.includes('8080'));
    if (!target) throw new Error('Could not find simulation target');
    
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
    
    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.result && res.result.exceptionDetails) {
        throw new Error('Eval failed: ' + JSON.stringify(res.result.exceptionDetails));
      }
      return res.result.result.value;
    }
    
    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(__dirname, filename), Buffer.from(res.result.data, 'base64'));
      console.log('Saved screenshot:', filename);
    }
    
    // Enable Page and Runtime
    await send('Page.enable');
    await send('Runtime.enable');
    
    console.log('--- Step 1: Check initial page state ---');
    const title = await evaluate('document.title');
    assert.equal(title, 'PD companion — Your catheter journey');
    
    console.log('--- Step 2: Navigate to Step 4 (Placing the catheter) ---');
    await evaluate('go(3)');
    const stepTitle = await evaluate('document.getElementById("phase-title").textContent');
    assert.equal(stepTitle, 'A small path into your belly');
    
    const hasGalleryBtn = await evaluate('!!document.querySelector("[data-action=\\"gallery-prompt\\"]")');
    assert.equal(hasGalleryBtn, true, 'Gallery button should exist in placement sequence');
    await captureScreenshot('step4-placement-view.png');
    
    console.log('--- Step 3: Open sensitive content prompt ---');
    await evaluate('document.querySelector("[data-action=\\"gallery-prompt\\"]").click()');
    const modalVisible = await evaluate('document.getElementById("modal").open');
    assert.equal(modalVisible, true);
    
    const promptTitle = await evaluate('document.getElementById("modal-title").textContent');
    assert.equal(promptTitle, 'Clinical Reference: Real Procedure Photos');
    await captureScreenshot('gallery-sensitive-warning.png');
    
    console.log('--- Step 4: Confirm consent to enter gallery ---');
    await evaluate('document.querySelector("[data-action=\\"confirm-gallery\\"]").click()');
    const isGalleryModal = await evaluate('document.getElementById("modal").classList.contains("gallery-modal")');
    assert.equal(isGalleryModal, true);
    
    const galleryTitle = await evaluate('document.getElementById("modal-title").textContent');
    assert.equal(galleryTitle, 'Clinical photo reference');
    await captureScreenshot('gallery-step-1.png');
    
    console.log('--- Step 5: Verify all 9 clinical steps load correctly ---');
    for (let i = 0; i < 9; i++) {
      await evaluate(`renderClinicalGallery(${i})`);
      await evaluate(`new Promise((resolve, reject) => {
        const img = document.getElementById('gallery-photo');
        if (img.complete && img.naturalWidth > 0) resolve();
        else {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image failed to load: ' + img.src));
          setTimeout(() => reject(new Error('Image load timed out: ' + img.src)), 3000);
        }
      })`);
      const stepData = await evaluate(`({
        index: state.galleryIndex,
        title: CLINICAL_STEPS[state.galleryIndex].title,
        imgSrc: document.getElementById('gallery-photo').src,
        imgNaturalWidth: document.getElementById('gallery-photo').naturalWidth,
        action: CLINICAL_STEPS[state.galleryIndex].action,
        rationale: CLINICAL_STEPS[state.galleryIndex].rationale,
        correlation: CLINICAL_STEPS[state.galleryIndex].correlation
      })`);
      
      console.log(`Step ${i + 1}: ${stepData.title} (Image width: ${stepData.imgNaturalWidth}px)`);
      assert.equal(stepData.index, i);
      assert(stepData.imgNaturalWidth > 0, `Image for step ${i + 1} did not load!`);
      assert(stepData.action.length > 20);
      assert(stepData.rationale.length > 20);
      assert(stepData.correlation.length > 10);
      
      if (i === 5) {
        await captureScreenshot('gallery-step-6-cuff.png');
      }
      if (i === 8) {
        await captureScreenshot('gallery-step-9-patency.png');
      }
    }
    
    console.log('--- Step 6: Test Navigation Controls (Prev/Next/Pills/Keyboard) ---');
    // Step 9 is index 8: Next button must be disabled
    const nextDisabled = await evaluate('document.getElementById("gallery-next").disabled');
    assert.equal(nextDisabled, true, 'Next button should be disabled on last step');
    
    // Jump to Step 3 via pill
    await evaluate('document.querySelector("[data-gallery-step=\\"2\\"]").click()');
    const curPill = await evaluate('state.galleryIndex');
    assert.equal(curPill, 2);
    
    // Test arrow left and right
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight"}))');
    assert.equal(await evaluate('state.galleryIndex'), 3);
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowLeft"}))');
    assert.equal(await evaluate('state.galleryIndex'), 2);
    
    console.log('--- Step 7: Close modal and verify cleanup ---');
    await evaluate('closeModal()');
    assert.equal(await evaluate('document.getElementById("modal").open'), false);
    assert.equal(await evaluate('document.getElementById("modal").classList.contains("gallery-modal")'), false);
    
    console.log('--- Step 8: Open gallery from Resources section (4th card) ---');
    await evaluate('document.querySelector(".resource[data-action=\\"gallery-prompt\\"]").click()');
    assert.equal(await evaluate('document.getElementById("modal").open'), true);
    assert.equal(await evaluate('document.getElementById("modal").classList.contains("gallery-modal")'), true);
    
    // Close again
    await evaluate('closeModal()');
    
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    ws.close();
  } finally {
    chrome.kill();
  }
})().catch(err => {
  console.error('CDP test failed:', err);
  process.exit(1);
});
