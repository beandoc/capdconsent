const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('Starting headless Chrome for Hindi and Marathi verification...');
  const chrome = exec('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9223 --window-size=1440,1050 --disable-gpu "http://localhost:8080/"');

  try {
    await new Promise(r => setTimeout(r, 1600));

    // Get pages from CDP on port 9223
    const pages = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = pages.find(p => p.url.includes('8080'));
    if (!target) throw new Error('Could not find simulation target on port 9223');

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

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('--- Test 1: Verify Hindi Switch & UI Rendering ---');
    await evaluate(`{
      go(0);
      const sel = document.getElementById('language');
      sel.value = 'hi';
      sel.dispatchEvent(new Event('change'));
    }`);
    const hiLang = await evaluate(`state.language`);
    assert.equal(hiLang, 'hi');
    const hiTitle = await evaluate(`document.getElementById('phase-title').textContent`);
    console.log('Hindi Step 1 Title:', hiTitle);
    assert.equal(hiTitle, 'अपने पीडी कैथेटर को समझें');
    await captureScreenshot('verify-hi-step1.png');

    console.log('--- Test 2: Verify Hindi Step 4 Anatomy & Sequence ---');
    await evaluate(`go(3)`);
    const hiStep4Title = await evaluate(`document.getElementById('phase-title').textContent`);
    console.log('Hindi Step 4 Title:', hiStep4Title);
    assert.equal(hiStep4Title, 'बेडसाइड प्रक्रिया, चरण दर चरण');
    await captureScreenshot('verify-hi-step4.png');

    console.log('--- Test 3: Verify Hindi Clinical Gallery with 10 Steps ---');
    await evaluate(`
      state.galleryConfirmed = true;
      renderClinicalGallery(9);
    `);
    const hiGalleryStep = await evaluate(`state.galleryIndex`);
    assert.equal(hiGalleryStep, 9); // Step 10 is index 9
    const hiGalleryTitle = await evaluate(`document.querySelector('.gallery-title').textContent`);
    console.log('Hindi Gallery Step 10 Title:', hiGalleryTitle);
    assert(hiGalleryTitle.includes('सीएपीडी कैथेटर स्थापना पूर्ण'));
    const hiImgSrc = await evaluate(`document.getElementById('gallery-photo').getAttribute('src')`);
    assert.equal(hiImgSrc, 'assets/clinical/step-10-catheter-complete.webp');
    await captureScreenshot('verify-hi-gallery-step10.png');
    await evaluate(`closeModal()`);

    console.log('--- Test 4: Verify Hindi Consent Tool ---');
    await evaluate(`
      renderConsentCompanion(0);
    `);
    const hiConsentTitle = await evaluate(`document.querySelector('.consent-badge').textContent`);
    console.log('Hindi Consent Module 1 Badge:', hiConsentTitle);
    assert(hiConsentTitle.includes('कमांड हॉस्पिटल (SC) पुणे'));
    await captureScreenshot('verify-hi-consent-overview.png');
    await evaluate(`closeModal()`);

    console.log('--- Test 5: Verify Marathi Switch & UI Rendering ---');
    await evaluate(`{
      const sel = document.getElementById('language');
      sel.value = 'mr';
      sel.dispatchEvent(new Event('change'));
    }`);
    const mrLang = await evaluate(`state.language`);
    assert.equal(mrLang, 'mr');
    const mrTitle = await evaluate(`document.getElementById('phase-title').textContent`);
    console.log('Marathi Step 4 Title:', mrTitle);
    assert.equal(mrTitle, 'बेडसाइड प्रक्रिया, टप्प्याटप्प्याने');
    await captureScreenshot('verify-mr-step4.png');

    console.log('--- Test 6: Verify Marathi Step 1 ---');
    await evaluate(`go(0)`);
    const mrStep1Title = await evaluate(`document.getElementById('phase-title').textContent`);
    console.log('Marathi Step 1 Title:', mrStep1Title);
    assert.equal(mrStep1Title, 'तुमचे पीडी कॅथेटर समजून घ्या');
    await captureScreenshot('verify-mr-step1.png');

    console.log('--- Test 7: Verify Marathi Clinical Gallery Step 10 ---');
    await evaluate(`
      state.galleryConfirmed = true;
      renderClinicalGallery(9);
    `);
    const mrGalleryStep = await evaluate(`state.galleryIndex`);
    assert.equal(mrGalleryStep, 9);
    const mrGalleryTitle = await evaluate(`document.querySelector('.gallery-title').textContent`);
    console.log('Marathi Gallery Step 10 Title:', mrGalleryTitle);
    assert(mrGalleryTitle.includes('सीएपीडी कॅथेटर बसवणे पूर्ण'));
    await captureScreenshot('verify-mr-gallery-step10.png');
    await evaluate(`closeModal()`);

    console.log('--- Test 8: Verify Marathi Consent Tool ---');
    await evaluate(`
      renderConsentCompanion(0);
    `);
    const mrConsentBadge = await evaluate(`document.querySelector('.consent-badge').textContent`);
    console.log('Marathi Consent Module 1 Badge:', mrConsentBadge);
    assert(mrConsentBadge.includes('कमांड हॉस्पिटल (SC) पुणे'));
    await captureScreenshot('verify-mr-consent-overview.png');
    await evaluate(`closeModal()`);

    console.log('\n===========================================');
    console.log('HINDI, MARATHI & STEP 10 VERIFIED 100%!');
    console.log('===========================================\n');
    process.exit(0);

  } catch (err) {
    console.error('Error during language verification:', err);
    process.exit(1);
  } finally {
    chrome.kill();
  }
})();
