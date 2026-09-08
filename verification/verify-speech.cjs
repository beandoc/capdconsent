const { exec } = require('child_process');
const http = require('http');
const assert = require('assert');

(async () => {
  console.log('Testing Speech Synthesis text sanitization in Chrome...');
  const chrome = exec('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=9227 "http://localhost:8080/"');

  try {
    await new Promise(r => setTimeout(r, 1600));
    const pages = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9227/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = pages.find(p => p.url.includes('8080'));
    if (!target) throw new Error('Target not found');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const send = (method, params = {}) => new Promise(resolve => {
      const id = msgId++;
      const handler = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) { ws.removeEventListener('message', handler); resolve(msg.result); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Runtime.enable');

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval failed: ${res.result.exceptionDetails.text}`);
      }
      return res.result ? res.result.value : undefined;
    };

    // Switch to Hindi
    await evaluate(`{
      go(0);
      const sel = document.getElementById('language');
      sel.value = 'hi';
      sel.dispatchEvent(new Event('change'));
    }`);

    // Intercept window.speechSynthesis.speak
    const speechResult = await evaluate(`(() => {
      let capturedText = null;
      let capturedVoice = null;
      let capturedRate = null;
      let capturedPitch = null;
      
      const originalSpeak = window.speechSynthesis.speak;
      window.speechSynthesis.speak = function(u) {
        capturedText = u.text;
        capturedVoice = u.voice ? u.voice.name : null;
        capturedRate = u.rate;
        capturedPitch = u.pitch;
      };

      // Call speak()
      speak();

      window.speechSynthesis.speak = originalSpeak;
      return { text: capturedText, voice: capturedVoice, rate: capturedRate, pitch: capturedPitch };
    })()`);

    console.log('--- Speech Interception Results ---');
    console.log('Selected Voice:', speechResult.voice);
    console.log('Rate:', speechResult.rate);
    console.log('Pitch:', speechResult.pitch);
    console.log('First 400 chars of spoken text:\n' + speechResult.text.slice(0, 400));

    // Verify zero stray ASCII periods (not decimal points)
    const strayDots = speechResult.text.match(/(?<!\d)\.(?!\d)/g);
    const dandaDots = speechResult.text.match(/।\./g);
    const middleDots = speechResult.text.match(/·/g);
    const ellipses = speechResult.text.match(/\.{2,}/g);

    console.log('Stray dots count:', strayDots ? strayDots.length : 0);
    console.log('Danda-dots count:', dandaDots ? dandaDots.length : 0);
    console.log('Middle-dots count:', middleDots ? middleDots.length : 0);
    console.log('Ellipses count:', ellipses ? ellipses.length : 0);

    assert.strictEqual(strayDots, null, 'Must NOT contain any stray periods that cause "dot dot dot"');
    assert.strictEqual(dandaDots, null, 'Must NOT contain ।.');
    assert.strictEqual(middleDots, null, 'Must NOT contain ·');
    assert.strictEqual(ellipses, null, 'Must NOT contain ...');
    assert.ok(Math.abs(speechResult.rate - 0.88) < 0.01, 'Rate should be approx 0.88 for natural Hindi cadence');

    console.log('\n===========================================');
    console.log('HINDI SPEECH SYNTHESIS FULLY VERIFIED! ZERO DOTS!');
    console.log('===========================================');

    ws.close();
  } finally {
    chrome.kill();
  }
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
