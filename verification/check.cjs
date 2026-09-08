// Run with PLAYWRIGHT_MODULE pointing to an installed playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', offline: true });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.clock.install();
    await page.screenshot({ path: path.join(__dirname, 'desktop.png'), fullPage: true });
    assert.equal(await page.locator('#phase-title').textContent(), 'Meet your PD catheter');
    assert.equal(await page.locator('.step').count(), 8);
    assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '0');

    // All anatomy hotspots have unique, explanatory text and preserve focus.
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-hotspot="${i}"]`).click();
      assert.equal(await page.locator(`[data-hotspot="${i}"]`).getAttribute('aria-pressed'), 'true');
      assert(await page.locator('.detail-note').textContent());
      assert.equal(await page.evaluate(() => document.activeElement.dataset.hotspot), String(i));
    }
    await page.locator('#caregiver-toggle').check();
    assert.equal(await page.locator('.caregiver-card').count(), 1);
    await page.locator('#language').selectOption('hi');
    assert.equal(await page.locator('#language').inputValue(), 'en');
    assert.match(await page.locator('#toast').textContent(), /not yet available/);
    await page.locator('#language').selectOption('mr');
    assert.equal(await page.locator('#language').inputValue(), 'en');

    // Every phase gives immediate feedback, accepts correction and retains it on revisits.
    for (let i = 0; i < 8; i++) {
      assert.equal(await page.locator('.step[aria-current="step"]').getAttribute('data-step'), String(i));
      const correct = await page.evaluate(() => phase().correct);
      await page.locator(`[data-answer="${1-correct}"]`).click();
      assert(await page.locator('#feedback').textContent());
      assert.match(await page.locator('#feedback').getAttribute('class'), /retry-text/);
      await page.locator(`[data-answer="${correct}"]`).click();
      assert(!(await page.locator('#feedback').getAttribute('class')).includes('retry-text'));
      if (i === 3) {
        for (let j = 0; j < 8; j++) {
          await page.locator(`[data-sequence="${j}"]`).click();
          assert.equal(await page.locator(`[data-sequence="${j}"]`).getAttribute('aria-pressed'), 'true');
        }
        await page.evaluate(() => document.getElementById('toast').hidden = true);
        await page.screenshot({ path: path.join(__dirname, 'placement.png'), fullPage: true });
        await page.locator('#play-sequence').click();
        assert.equal(await page.evaluate(() => state.playing), true);
        await page.clock.fastForward(5300);
        assert.equal(await page.evaluate(() => state.sequence), 1);
        await page.locator('#play-sequence').click();
        assert.equal(await page.evaluate(() => state.playing), false);
        await page.locator('#play-sequence').click();
        assert.equal(await page.evaluate(() => state.sequence), 1, 'Resume retains the paused part');
        
        for (let k = 2; k <= 7; k++) {
          await page.clock.fastForward(5300);
          assert.equal(await page.evaluate(() => state.sequence), k, `Sequence should advance to stage ${k}`);
          if (k >= 5) {
            assert.equal(await page.locator('.route').evaluate(el => getComputedStyle(el).animationName), 'none');
          }
        }
        assert.equal(await page.evaluate(() => state.playing), false, 'Playing must stop at stage 7');

        // Test clinical reference gallery opt-in and full navigation
        await page.locator('[data-action="gallery-prompt"]').first().click();
        assert(await page.locator('#modal').isVisible());
        assert.match(await page.locator('#modal-body').textContent(), /clinical photographs of percutaneous PD catheter placement/);
        // Test decline / keep illustrated guide
        await page.locator('[data-action="close"]').click();
        assert(!(await page.locator('#modal').isVisible()));
        assert.equal(await page.evaluate(() => state.galleryConfirmed), false);

        // Open again and confirm
        await page.locator('[data-action="gallery-prompt"]').first().click();
        await page.locator('[data-action="confirm-gallery"]').click();
        assert(await page.locator('#modal').isVisible());
        assert.equal(await page.evaluate(() => state.galleryConfirmed), true);
        assert.equal(await page.locator('#modal').evaluate(el => el.classList.contains('gallery-modal')), true);
        assert.equal(await page.locator('#modal-title').textContent(), 'Clinical photo reference');
        
        // Verify all 9 clinical steps navigate and photos render with valid natural dimensions
        for (let s = 0; s < 9; s++) {
          assert.equal(await page.evaluate(() => state.galleryIndex), s);
          const imgNaturalWidth = await page.locator('#gallery-photo').evaluate(async img => {
            if (!img.complete) {
              await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 500); });
            }
            try { await img.decode(); } catch (e) {}
            return img.naturalWidth;
          });
          const imgSrc = await page.locator('#gallery-photo').getAttribute('src');
          assert(imgNaturalWidth > 0, `Clinical image for step ${s+1} (${imgSrc}) failed to load or has 0 naturalWidth`);
          if (s < 8) {
            await page.locator('#gallery-next').click();
          }
        }
        assert.equal(await page.locator('#gallery-next').isDisabled(), true);
        // Test pill jump
        await page.locator('[data-gallery-step="2"]').click();
        assert.equal(await page.evaluate(() => state.galleryIndex), 2);
        // Test keyboard arrow left/right
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => state.galleryIndex), 3);
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.evaluate(() => state.galleryIndex), 2);
        // Close modal
        await page.locator('#close-modal').click();
        assert(!(await page.locator('#modal').isVisible()));
        assert.equal(await page.locator('#modal').evaluate(el => el.classList.contains('gallery-modal')), false);
      }
      await page.locator('#next').click();
    }
    assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '8');
    assert(await page.locator('#completion').isVisible());
    assert.match(await page.locator('#completion').textContent(), /does not record consent/);
    await page.locator('[data-step="0"]').first().click();
    assert.equal(await page.locator('[data-answer="0"]').getAttribute('aria-pressed'), 'true');

    // Modal keyboard behavior and missing real-world contacts are honest.
    await page.locator('.top-actions [data-action="team"]').click();
    assert(await page.locator('#modal').isVisible());
    assert.match(await page.locator('.contact-box').textContent(), /Ask your clinic/);
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#modal').isVisible()));
    for (const kind of ['summary','checklist','caregiver','gallery-prompt','consent-tool','sources']) {
      await page.locator(`.resource[data-action="${kind}"], .footer [data-action="${kind}"]`).click();
      assert(await page.locator('#modal').isVisible());
      if (kind === 'summary') {
        const downloadEvent = page.waitForEvent('download');
        await page.locator('[data-action="download"]').click();
        const download = await downloadEvent;
        const savePath = path.join(__dirname, 'summary.pdf');
        await download.saveAs(savePath);
        const pdf = fs.readFileSync(savePath, 'utf8');
        assert(pdf.startsWith('%PDF-1.4'));
        assert(pdf.includes('/Count 1'));
        assert(pdf.includes('at least 2 weeks'));
        assert(pdf.includes('Cloudy drained dialysis fluid'));
      }
      if (kind === 'checklist') {
        assert.equal(await page.locator('.print-check input').count(), 6);
        await page.locator('.print-check input').first().check();
        await page.pdf({path:path.join(__dirname,'checklist.pdf'),format:'A4',preferCSSPageSize:true});
      }
      if (kind === 'caregiver') await page.pdf({path:path.join(__dirname,'caregiver.pdf'),format:'A4',preferCSSPageSize:true});
      await page.locator('#close-modal').click();
    }

    // Font resizing and screen widths must not introduce horizontal overflow.
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({width, height:1000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `Horizontal overflow at ${width}px`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => document.getElementById('toast').hidden = true);
    await page.screenshot({path:path.join(__dirname,'mobile.png'),fullPage:true});
    for(let i=0;i<3;i++) await page.locator('#font-up').click();
    assert.equal(await page.locator('#font-up').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'Large-font mobile overflow');
    await page.evaluate(() => document.getElementById('toast').hidden = true);
    await page.screenshot({path:path.join(__dirname,'mobile-large-text.png'),fullPage:true});
    for(let i=0;i<3;i++) await page.locator('#font-down').click();
    assert.equal(await page.locator('#font-down').isDisabled(),true);

    // Skipping is allowed without falsely marking skipped steps completed.
    await page.setViewportSize({width:1440,height:1100});
    await page.locator('[data-action="reset"]').click();
    await page.locator('[data-action="confirm-reset"]').click();
    assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'),'0');
    await page.locator('[data-step="7"]').first().click();
    assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'),'0');
    await page.locator('#next').click();
    assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'),'1');
    assert.match(await page.locator('#completion').textContent(),/steps you skipped/);

    // Test the audio control contract independently of OS voice availability.
    await page.evaluate(() => {
      window.testSpeech = {voices:[],spoken:[],cancelled:0};
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
        getVoices:()=>window.testSpeech.voices,
        speak:u=>window.testSpeech.spoken.push(u),
        cancel:()=>window.testSpeech.cancelled++,
      }});
      window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    });
    await page.locator('#listen').click();
    assert.match(await page.locator('#toast').textContent(),/No offline English voice/);
    await page.evaluate(()=>testSpeech.voices=[{lang:'en-US',localService:false}]);
    await page.locator('#listen').click();
    assert.equal(await page.evaluate(()=>testSpeech.spoken.length),0,'Network voices must not be used');
    await page.evaluate(()=>testSpeech.voices.push({lang:'en-IN',localService:true}));
    await page.locator('#listen').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#listen').getAttribute('aria-pressed'),'true');
    assert.match(await page.evaluate(()=>testSpeech.spoken[0].text),/Cloudy drained dialysis fluid/);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#listen').getAttribute('aria-pressed'),'false');
    assert(await page.evaluate(()=>testSpeech.cancelled>0));
    assert.deepEqual(errors,[],'Browser JavaScript errors');
    assert.deepEqual(requests,[],'Unexpected network requests');
    console.log('PASS: 8 phases, 16 feedback paths, hotspots, placement controls, caregiver mode, language fallbacks, modal keyboard dismissal, PDF download, print resources, 5 screen widths, enlarged text, progress/revisit/reset/skip semantics, offline operation, zero page errors.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
