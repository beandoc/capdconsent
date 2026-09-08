const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.addScriptTag({path:process.env.AXE_PATH});
    const results=[];
    const audit=async(name)=>{
      const report=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
      results.push({name,violations:report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
    };
    for(let i=0;i<8;i++){await page.locator(`[data-step="${i}"]`).first().click();await audit('phase '+(i+1));}
    await page.locator('#caregiver-toggle').check();await audit('caregiver enabled');
    for(const kind of ['team','summary','checklist','caregiver','gallery-prompt','sources']){
      await page.locator(`button[data-action="${kind}"]`).first().click();await audit(kind+' dialog');await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:390,height:844});
    for(let i=0;i<3;i++)await page.locator('#font-up').click();
    await audit('mobile enlarged text');
    const violations=results.filter(r=>r.violations.length);
    console.log(JSON.stringify(violations,null,2));
    assert.equal(violations.length,0,'Accessibility violations found');
    console.log('PASS: WCAG A/AA automated checks on all 8 steps, caregiver mode, 5 dialogs, and mobile with enlarged text.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
