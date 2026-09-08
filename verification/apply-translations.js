const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const indexPath = path.resolve(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const {
  hi,
  mr,
  CLINIC_CONFIG_I18N,
  CLINICAL_STEPS_HI,
  CLINICAL_STEPS_MR,
  CONSENT_SECTIONS_HI,
  CONSENT_SECTIONS_MR
} = require('./generate-merged-translations.js');

// 1. Replace hi: null, mr: null with JSON representations of hi and mr in TRANSLATIONS
const hiStr = JSON.stringify(hi);
const mrStr = JSON.stringify(mr);

const oldTranslationsPattern = /  const TRANSLATIONS = \{[\s\S]*?\n  \};/;
const match = html.match(oldTranslationsPattern);
if (!match) throw new Error('Could not find TRANSLATIONS in index.html');

// Extract existing en object
const vmContext = {};
vm.createContext(vmContext);
vm.runInContext('var TRANSLATIONS = ' + match[0].replace('const TRANSLATIONS = ', ''), vmContext);
const enStr = JSON.stringify(vmContext.TRANSLATIONS.en);

const newTranslationsCode = `  const TRANSLATIONS = {\n    en: ${enStr},\n    hi: ${hiStr},\n    mr: ${mrStr}\n  };`;
html = html.replace(oldTranslationsPattern, newTranslationsCode);

// 2. Inject CLINIC_CONFIG_I18N right after CLINIC_CONFIG
const clinicConfigPattern = /(const CLINIC_CONFIG = \{[\s\S]*?\n  \};)/;
const clinicConfigMatch = html.match(clinicConfigPattern);
if (!clinicConfigMatch) throw new Error('Could not find CLINIC_CONFIG');

const newClinicConfig = `${clinicConfigMatch[1]}\n  const CLINIC_CONFIG_I18N = ${JSON.stringify(CLINIC_CONFIG_I18N)};\n  const tClinic = (key) => (CLINIC_CONFIG_I18N[state.language]?.[key] || CLINIC_CONFIG[key]);`;
html = html.replace(clinicConfigPattern, newClinicConfig);

// 3. Inject CLINICAL_STEPS_I18N and CONSENT_SECTIONS_I18N
// Find where CLINICAL_STEPS is defined
const cStepsPattern = /  const CLINICAL_STEPS = (\[[\s\S]*?\n  \];)/;
const cStepsMatch = html.match(cStepsPattern);
if (!cStepsMatch) throw new Error('Could not find CLINICAL_STEPS');

const newClinicalSteps = `  const CLINICAL_STEPS = ${cStepsMatch[1]}\n  const CLINICAL_STEPS_I18N = {\n    en: CLINICAL_STEPS,\n    hi: ${JSON.stringify(CLINICAL_STEPS_HI)},\n    mr: ${JSON.stringify(CLINICAL_STEPS_MR)}\n  };`;
html = html.replace(cStepsPattern, newClinicalSteps);

// Find where CONSENT_SECTIONS is defined
const cSectionsPattern = /  const CONSENT_SECTIONS = (\[[\s\S]*?\n  \];)/;
const cSectionsMatch = html.match(cSectionsPattern);
if (!cSectionsMatch) throw new Error('Could not find CONSENT_SECTIONS');

const newConsentSections = `  const CONSENT_SECTIONS = ${cSectionsMatch[1]}\n  const CONSENT_SECTIONS_I18N = {\n    en: CONSENT_SECTIONS,\n    hi: ${JSON.stringify(CONSENT_SECTIONS_HI)},\n    mr: ${JSON.stringify(CONSENT_SECTIONS_MR)}\n  };`;
html = html.replace(cSectionsPattern, newConsentSections);

// 4. Update renderClinicalGallery to use CLINICAL_STEPS_I18N[state.language]
const oldGalleryRender = `  function renderClinicalGallery(index){
    const cur=Math.max(0,Math.min(CLINICAL_STEPS.length-1,index));
    state.galleryIndex=cur;
    const step=CLINICAL_STEPS[cur];`;

const newGalleryRender = `  function renderClinicalGallery(index){
    const steps = CLINICAL_STEPS_I18N[state.language] || CLINICAL_STEPS;
    const cur = Math.max(0, Math.min(steps.length-1, index));
    state.galleryIndex = cur;
    const step = steps[cur];`;
assert(html.includes(oldGalleryRender), 'Could not find oldGalleryRender');
html = html.replace(oldGalleryRender, newGalleryRender);

// Replace remaining CLINICAL_STEPS references inside renderClinicalGallery
html = html.replace(/CLINICAL_STEPS\.length/g, 'steps.length');
html = html.replace(/CLINICAL_STEPS\.map/g, 'steps.map');

// 5. Update renderConsentCompanion to use CONSENT_SECTIONS_I18N[state.language]
const oldConsentRender = `  function renderConsentCompanion(stepIndex){
    const cur=Math.max(0,Math.min(CONSENT_SECTIONS.length-1,stepIndex));
    state.consentStep=cur;
    const sec=CONSENT_SECTIONS[cur];`;

const newConsentRender = `  function renderConsentCompanion(stepIndex){
    const sections = CONSENT_SECTIONS_I18N[state.language] || CONSENT_SECTIONS;
    const cur = Math.max(0, Math.min(sections.length-1, stepIndex));
    state.consentStep = cur;
    const sec = sections[cur];`;
assert(html.includes(oldConsentRender), 'Could not find oldConsentRender');
html = html.replace(oldConsentRender, newConsentRender);

// Update stepper mapping inside renderConsentCompanion
html = html.replace(
  `\${CONSENT_SECTIONS.map((s,i)=>`,
  `\${sections.map((s,i)=>`
);

// 6. Update handoutBody to use tClinic
html = html.replace(/CLINIC_CONFIG\.markingInstructions/g, `tClinic('markingInstructions')`);
html = html.replace(/CLINIC_CONFIG\.fastingInstructions/g, `tClinic('fastingInstructions')`);
html = html.replace(/CLINIC_CONFIG\.medicationInstructions/g, `tClinic('medicationInstructions')`);
html = html.replace(/CLINIC_CONFIG\.dialysisStartInstructions/g, `tClinic('dialysisStartInstructions')`);
html = html.replace(/CLINIC_CONFIG\.dressingInstructions/g, `tClinic('dressingInstructions')`);
html = html.replace(/CLINIC_CONFIG\.dailyCareInstructions/g, `tClinic('dailyCareInstructions')`);
html = html.replace(/CLINIC_CONFIG\.activityInstructions/g, `tClinic('activityInstructions')`);
html = html.replace(/CLINIC_CONFIG\.bathingInstructions/g, `tClinic('bathingInstructions')`);

// 7. Update speak() to use tClinic
html = html.replace(
  `...(p.points||[]).map(k=>CLINIC_CONFIG[k])`,
  `...(p.points||[]).map(k=>tClinic(k))`
);

// 8. Update downloadConsentRecord() so non-Latin/non-English triggers window.print()
const oldConsentPdfStart = `  function downloadConsentRecord(){\n    const latin=s=>String(s||'').normalize('NFKD')`;
const newConsentPdfStart = `  function downloadConsentRecord(){\n    if(state.language!=='en'){window.print();return;}\n    const latin=s=>String(s||'').normalize('NFKD')`;
assert(html.includes(oldConsentPdfStart), 'Could not find oldConsentPdfStart');
html = html.replace(oldConsentPdfStart, newConsentPdfStart);

// 9. Write out updated index.html
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully updated index.html with complete Hindi and Marathi translations!');
