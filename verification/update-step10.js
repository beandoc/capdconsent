const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const indexPath = path.resolve(__dirname, '../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Step 10 objects
const step10En = {
  title: 'Completed CAPD Catheter Placement & Transfer Set Assembly',
  sub: 'Final external assembly, titanium adapter & minicap closure',
  image: 'assets/clinical/step-10-catheter-complete.webp',
  alt: 'Abdomen showing completed CAPD catheter emerging from exit site, connected via titanium adapter to transfer set with minicap',
  instruments: ['Titanium Catheter Adapter', 'PD Transfer Set (Twist Clamp)', 'Povidone-Iodine Minicap', 'External Silicone Catheter'],
  action: 'The CAPD catheter insertion is complete. A titanium connector bridges the exteriorized silicone catheter to the transfer set, which is sealed with a povidone-iodine minicap. The tube is looped in a gentle upward arch to eliminate exit-site tension before sterile gauze dressing is applied.',
  rationale: 'A tension-free, downward-directed configuration prevents mechanical tugging on the healing Dacron cuffs, minimizes exit-site trauma, and reduces infection risk. The closed transfer set with betadine minicap maintains a sterile closed system throughout the 2-week break-in healing period.',
  correlation: 'Matches Step 7 · Living with your catheter: Settled exit site with tube secured, tension-free, and capped for healing.'
};

const step10Hi = {
  title: 'सीएपीडी कैथेटर स्थापना पूर्ण एवं ट्रांसफर सेट संयोजन',
  sub: 'अंतिम बाह्य संरचना, टाइटेनियम एडॉप्टर एवं मिनीकैप सील',
  image: 'assets/clinical/step-10-catheter-complete.webp',
  alt: 'पेट का दृश्य जिसमें पूरा स्थापित सीएपीडी कैथेटर निकास स्थल से बाहर आकर टाइटेनियम एडॉप्टर और ट्रांसफर सेट से जुड़ा हुआ दिखाई दे रहा है',
  instruments: ['टाइटेनियम कैथेटर एडॉप्टर', 'पीडी ट्रांसफर सेट (ट्विस्ट क्लैंप)', 'पोविडोन-आयोडीन मिनीकैप', 'बाह्य सिलिकॉन कैथेटर'],
  action: 'सीएपीडी कैथेटर डालने की प्रक्रिया पूरी हो चुकी है। एक टाइटेनियम कनेक्टर बाहर निकले सिलिकॉन कैथेटर को ट्रांसफर सेट से जोड़ता है, जिसे पोविडोन-आयोडीन मिनीकैप से सील किया जाता है। निकास स्थल पर खिंचाव से बचने के लिए नली को एक सौम्य मोड़ दिया जाता है।',
  rationale: 'तनाव-मुक्त और नीचे की ओर उन्मुख विन्यास घाव भर रहे डैक्रॉन कफ पर यांत्रिक खिंचाव को रोकता है और निकास स्थल पर चोट के जोखिम को कम करता है। बंद ट्रांसफर सेट और मिनीकैप 2 सप्ताह के ब्रेक-इन समय में रोगाणुमुक्त बंद प्रणाली बनाए रखते हैं।',
  correlation: 'गाइड चरण 7 से संबंधित · कैथेटर के साथ जीवन: निकास स्थल सुरक्षित, खिंचाव-मुक्त और घाव भरने के लिए सीलबंद।'
};

const step10Mr = {
  title: 'सीएपीडी कॅथेटर बसवणे पूर्ण आणि ट्रान्सफर सेट जोडणी',
  sub: 'अंतिम बाह्य रचना, टायटॅनियम अडॅप्टर आणि मिनीकॅप सील',
  image: 'assets/clinical/step-10-catheter-complete.webp',
  alt: 'पोटाचे दृश्य ज्यामध्ये पूर्ण बसवलेले सीएपीडी कॅथेटर एक्झिट जागेतून बाहेर येऊन टायटॅनियम अडॅप्टर आणि ट्रान्सफर सेटला जोडलेले दिसत आहे',
  instruments: ['टायटॅनियम कॅथेटर अडॅप्टर', 'पीडी ट्रान्सफर सेट (ट्विस्ट क्लॅम्प)', 'पोव्हिडोन-आयोडीन मिनीकॅप', 'बाह्य सिलिकॉन कॅथेटर'],
  action: 'सीएपीडी कॅथेटर बसवण्याची प्रक्रिया पूर्ण झाली आहे. टायटॅनियम कनेक्टर बाहेरील सिलिकॉन कॅथेटरला ट्रान्सफर सेटशी जोडतो, जो पोव्हिडोन-आयोडीन मिनीकॅपने सील केला जातो. एक्झिट जागेवर ताण येऊ नये म्हणून नळीला वरच्या दिशेने वळवून सुरक्षित केले जाते.',
  rationale: 'ताणमुक्त आणि योग्य दिशेची रचना बरे होत असलेल्या डॅक्रॉन कफवर ओढ पडू देत नाही आणि जखमेच्या संसर्गाचा धोका कमी करते. मिनीकॅप 2 आठवड्यांच्या ब्रेक-इन काळात निर्जंतुक बंद प्रणाली राखतो.',
  correlation: 'मार्गदर्शक टप्पा 7 शी संबंधित · कॅथेटरसोबत जीवन: एक्झिट साइट सुरक्षित, ताणमुक्त आणि बरे होण्यासाठी सीलबंद.'
};

// 1. Update CLINICAL_STEPS array in index.html
// Extract CLINICAL_STEPS
const csMatch = html.match(/const CLINICAL_STEPS = (\[[\s\S]*?\n  \];)/);
if (!csMatch) throw new Error('Could not find CLINICAL_STEPS');

const vmContext = {};
vm.createContext(vmContext);
vm.runInContext('var steps = ' + csMatch[1], vmContext);
let stepsEn = vmContext.steps;

// If step 10 not already there, push it
if (stepsEn.length === 9) {
  stepsEn.push(step10En);
}

// 2. Extract CLINICAL_STEPS_I18N
const csI18nMatch = html.match(/const CLINICAL_STEPS_I18N = (\{[\s\S]*?\n  \};)/);
if (!csI18nMatch) throw new Error('Could not find CLINICAL_STEPS_I18N');

const vmContext2 = { CLINICAL_STEPS: stepsEn };
vm.createContext(vmContext2);
vm.runInContext('var CLINICAL_STEPS_I18N = ' + csI18nMatch[1], vmContext2);
let stepsI18n = vmContext2.CLINICAL_STEPS_I18N;
stepsI18n.en = stepsEn;

if (stepsI18n.hi.length === 9) stepsI18n.hi.push(step10Hi);
if (stepsI18n.mr.length === 9) stepsI18n.mr.push(step10Mr);

// 3. Update TRANSLATIONS gallery texts to 10
const trMatch = html.match(/const TRANSLATIONS = (\{[\s\S]*?\n  \};)/);
if (!trMatch) throw new Error('Could not find TRANSLATIONS');

const vmContext3 = {};
vm.createContext(vmContext3);
vm.runInContext('var TRANSLATIONS = ' + trMatch[1], vmContext3);
let translations = vmContext3.TRANSLATIONS;

// English updates
translations.en.gallerySub = '10 real procedure steps · Clinical reference';
translations.en.clinicalPhotosBtn = 'Real procedure photos (10)';
translations.en.gallerySensitiveIntro = 'This section contains 10 real clinical photographs of percutaneous PD catheter placement, illustrating needle access, fluid hydrodissection, guidewire feeding, dilator & peel-away sheath advancement, catheter delivery, fluid flow testing, and completed catheter assembly with transfer set.';
translations.en.viewPhotos = 'View clinical photos (10 steps)';

// Hindi updates
translations.hi.gallerySub = '10 वास्तविक प्रक्रिया चरण · क्लिनिकल संदर्भ';
translations.hi.clinicalPhotosBtn = 'प्रक्रिया के वास्तविक चित्र (10)';
translations.hi.gallerySensitiveIntro = 'इस खंड में परक्यूटेनियस पीडी कैथेटर डालने की प्रक्रिया के 10 वास्तविक चिकित्सीय चित्र शामिल हैं, जिनमें सुई प्रवेश, तरल हाइड्रोडिसेक्शन, गाइडवायर डालना, डाइलेटर व पील-अवे शीथ, कैथेटर स्थापना, तरल प्रवाह परीक्षण और ट्रांसफर सेट के साथ पूर्ण कैथेटर संयोजन दिखाया गया है।';
translations.hi.viewPhotos = 'वास्तविक चित्र देखें (10 चरण)';

// Marathi updates
translations.mr.gallerySub = '10 प्रत्यक्ष प्रक्रिया टप्पे · वैद्यकीय संदर्भ';
translations.mr.clinicalPhotosBtn = 'प्रत्यक्ष प्रक्रियेची छायाचित्रे (10)';
translations.mr.gallerySensitiveIntro = 'या विभागात परक्युटेनियस पीडी कॅथेटर बसवण्याच्या प्रक्रियेची 10 प्रत्यक्ष वैद्यकीय छायाचित्रे आहेत, ज्यामध्ये सुई प्रवेश, सलाईन हायड्रोडिसेक्शन, गाईडवायर, डायलेटर आणि पील-अवे शीथ, कॅथेटर बसवणे, द्रव प्रवाह चाचणी आणि ट्रान्सफर सेटसह पूर्ण रचना दाखवली आहे.';
translations.mr.viewPhotos = 'प्रत्यक्ष छायाचित्रे पहा (10 टप्पे)';

// Replace in HTML
html = html.replace(
  csMatch[0],
  `const CLINICAL_STEPS = ${JSON.stringify(stepsEn, null, 2)};`
);

html = html.replace(
  csI18nMatch[0],
  `const CLINICAL_STEPS_I18N = {\n    en: CLINICAL_STEPS,\n    hi: ${JSON.stringify(stepsI18n.hi)},\n    mr: ${JSON.stringify(stepsI18n.mr)}\n  };`
);

html = html.replace(
  trMatch[0],
  `const TRANSLATIONS = {\n    en: ${JSON.stringify(translations.en)},\n    hi: ${JSON.stringify(translations.hi)},\n    mr: ${JSON.stringify(translations.mr)}\n  };`
);

// Fix event listeners to use CLINICAL_STEPS.length - 1
html = html.replace(
  `if(target.id==='gallery-next'){if(state.galleryIndex<steps.length-1)renderClinicalGallery(state.galleryIndex+1);return;}`,
  `if(target.id==='gallery-next'){if(state.galleryIndex<CLINICAL_STEPS.length-1)renderClinicalGallery(state.galleryIndex+1);return;}`
);

html = html.replace(
  `else if(e.key==='ArrowRight'&&state.galleryIndex<steps.length-1)renderClinicalGallery(state.galleryIndex+1);`,
  `else if(e.key==='ArrowRight'&&state.galleryIndex<CLINICAL_STEPS.length-1)renderClinicalGallery(state.galleryIndex+1);`
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully added Step 10 and updated index.html! CLINICAL_STEPS count:', stepsEn.length);
