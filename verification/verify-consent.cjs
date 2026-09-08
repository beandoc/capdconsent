const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('Starting headless Chrome for consent tool verification...');
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
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Page.navigate', { url: 'http://localhost:8080/' });
    await new Promise(r => setTimeout(r, 600));

    console.log('--- Test 1: Verify Initial Page & Resources Button ---');
    const title = await evaluate('document.title');
    assert.equal(title, 'PD Consent Buddy — Your catheter journey');

    const hasResourceBtn = await evaluate('!!document.querySelector("button[data-action=\\"consent-tool\\"]")');
    assert.equal(hasResourceBtn, true, 'Resource consent button must exist');

    console.log('--- Test 2: Open Consent Companion from Resources ---');
    await evaluate('document.querySelector("button[data-action=\\"consent-tool\\"]").click()');
    const isOpen = await evaluate('document.getElementById("modal").open');
    assert.equal(isOpen, true, 'Modal should be open');
    const isConsentModal = await evaluate('document.getElementById("modal").classList.contains("consent-modal")');
    assert.equal(isConsentModal, true, 'Modal should have consent-modal class');
    const modalTitle = await evaluate('document.getElementById("modal-title").textContent');
    assert.equal(modalTitle, 'Informed Consent & Shared Decision Companion');

    // Screenshot Module 1
    await captureScreenshot('consent-module1-overview.png');

    console.log('--- Test 3: Verify Stepper & Module Progression ---');
    const stepCount = await evaluate('document.querySelectorAll(".consent-step-btn").length');
    assert.equal(stepCount, 6, 'Should have 6 stepper module buttons');

    // Click Proceed to Step 2
    await evaluate('document.querySelector("[data-consent-next]").click()');
    const step2Active = await evaluate('state.consentStep');
    assert.equal(step2Active, 1, 'Should now be on Step index 1 (Technique)');

    // Jump to Module 4 (Risks & Safety)
    await evaluate('document.querySelector("[data-consent-step=\\"3\\"]").click()');
    const step4Active = await evaluate('state.consentStep');
    assert.equal(step4Active, 3, 'Should be on Step index 3 (Risks)');
    const hasImmediate = await evaluate('!!document.querySelector(".risk-card-immediate")');
    const hasDelayed = await evaluate('!!document.querySelector(".risk-card-delayed")');
    assert.equal(hasImmediate, true, 'Should have immediate risk cards');
    assert.equal(hasDelayed, true, 'Should have delayed risk cards');
    await captureScreenshot('consent-module4-risks.png');

    console.log('--- Test 4: Verify Comprehension Quiz Interaction ---');
    // Proceed to Step 5 (Quiz)
    await evaluate('document.querySelector("[data-consent-step=\\"4\\"]").click()');
    const quizItems = await evaluate('document.querySelectorAll(".consent-quiz-item").length');
    assert.equal(quizItems, 4, 'Should render 4 quiz questions');

    // Answer Question 1 correctly (option 1)
    await evaluate('document.querySelector("[data-consent-quiz-q=\\"0\\"][data-consent-quiz-opt=\\"1\\"]").click()');
    // Answer Question 2 correctly (option 1)
    await evaluate('document.querySelector("[data-consent-quiz-q=\\"1\\"][data-consent-quiz-opt=\\"1\\"]").click()');
    // Answer Question 3 correctly (option 0)
    await evaluate('document.querySelector("[data-consent-quiz-q=\\"2\\"][data-consent-quiz-opt=\\"0\\"]").click()');
    // Answer Question 4 correctly (option 1)
    await evaluate('document.querySelector("[data-consent-quiz-q=\\"3\\"][data-consent-quiz-opt=\\"1\\"]").click()');

    const answeredCount = await evaluate('Object.keys(state.consentQuiz).length');
    assert.equal(answeredCount, 4, 'All 4 questions answered');
    await captureScreenshot('consent-module5-quiz.png');

    console.log('--- Test 5: Patient Form & Declarations (Module 6) ---');
    await evaluate('document.querySelector("[data-consent-step=\\"5\\"]").click()');
    
    // Verify placeholders are empty as requested
    const namePlaceholder = await evaluate('document.getElementById("consent-input-name").getAttribute("placeholder")');
    assert.equal(namePlaceholder, '', 'Patient name placeholder must be empty');
    const docPlaceholder = await evaluate('document.getElementById("consent-input-clinician").getAttribute("placeholder")');
    assert.equal(docPlaceholder, '', 'Clinician placeholder must be empty');
    
    // Verify removed fields do not exist in DOM
    const svcExists = await evaluate('!!document.getElementById("consent-input-serviceno")');
    assert.equal(svcExists, false, 'Service no input must be removed');
    const rankExists = await evaluate('!!document.getElementById("consent-input-rank")');
    assert.equal(rankExists, false, 'Rank input must be removed');
    const unitExists = await evaluate('!!document.getElementById("consent-input-unit")');
    assert.equal(unitExists, false, 'Unit input must be removed');
    const diagExists = await evaluate('!!document.getElementById("consent-input-diag")');
    assert.equal(diagExists, false, 'Diagnosis input must be removed');
    const mrnExists = await evaluate('!!document.getElementById("consent-input-mrn")');
    assert.equal(mrnExists, true, 'MRN/HID input must be present');

    await captureScreenshot('consent-module6-unfilled.png');

    // Fill in form inputs
    await evaluate(`(() => {
      const nameInput = document.getElementById('consent-input-name');
      nameInput.value = 'Eleanor Vance';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      const ageInput = document.getElementById('consent-input-age');
      ageInput.value = '62 / Female';
      ageInput.dispatchEvent(new Event('input', { bubbles: true }));

      const mrnInput = document.getElementById('consent-input-mrn');
      mrnInput.value = 'MRN-83921';
      mrnInput.dispatchEvent(new Event('input', { bubbles: true }));

      const docInput = document.getElementById('consent-input-clinician');
      docInput.value = 'Dr. Anita Sharma';
      docInput.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    const storedName = await evaluate('state.consentPatient.name');
    assert.equal(storedName, 'Eleanor Vance');
    const storedMrn = await evaluate('state.consentPatient.mrn');
    assert.equal(storedMrn, 'MRN-83921');

    const declCount = await evaluate('document.querySelectorAll(".decl-item").length');
    assert.equal(declCount, 6, 'Should display 6 declarations');

    const sigsExist = await evaluate('!!document.querySelector(".signature-preview")');
    assert.equal(sigsExist, true, 'Signature preview block must exist');
    await captureScreenshot('consent-module6-declarations.png');

    console.log('--- Test 6: Verify Zero-Dependency A4 PDF Generation ---');
    await evaluate('downloadConsentRecord()');
    const toastMsg = await evaluate('document.getElementById("toast").textContent');
    assert.equal(toastMsg, 'Your Informed Discussion Record (PDF) has been downloaded.');

    console.log('--- Test 7: Modal Close and Clean-up ---');
    await evaluate('closeModal()');
    const isClosed = await evaluate('!document.getElementById("modal").open');
    assert.equal(isClosed, true, 'Modal should close cleanly');
    const classRemoved = await evaluate('!document.getElementById("modal").classList.contains("consent-modal")');
    assert.equal(classRemoved, true, 'consent-modal class should be removed');

    console.log('--- Test 8: Step 4 Placement Toolbar Button ---');
    await evaluate('go(3)');
    const step4ConsentBtn = await evaluate('!!document.querySelector(".play-left button[data-action=\\"consent-tool\\"]")');
    assert.equal(step4ConsentBtn, true, 'Consent button in Step 4 controls must exist');

    console.log('--- Test 9: Step 8 Completion Screen CTA ---');
    await evaluate('go(7)');
    await evaluate('next()'); // trigger finish
    const completionConsentBtn = await evaluate('!!document.querySelector("#completion button[data-action=\\"consent-tool\\"]")');
    assert.equal(completionConsentBtn, true, 'Consent CTA in completion box must exist');

    console.log('--- Test 10: Mobile Viewport Verification (390 x 844) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await evaluate('openModal("consent-tool")');
    await captureScreenshot('consent-mobile-view.png');

    console.log('\n===========================================');
    console.log('ALL 10 VERIFICATION TESTS PASSED PERFECTLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Test failed:', err);
    try { chrome.kill(); } catch (e) {}
    process.exit(1);
  } finally {
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  }
})();
