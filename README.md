# PD Consent Buddy — Simulation, Clinical Reference & Consent Companion

Open **index.html** in Chrome, Edge, Safari, or Firefox. 

> [!IMPORTANT]
> **Asset Packaging:** The app is no longer a single standalone file. The `assets/clinical/*.webp` directory containing 10 high-resolution procedural photographs must accompany `index.html` when copying or deploying the tool to clinic tablets or computers.

This is a comprehensive patient and caregiver education and shared decision-making system for **percutaneous PD catheter insertion (CAPD/APD)**. It integrates:
1. **Realistic Anatomical Rebuild Engine:** Layered cut-through of the abdominal wall (skin $\to$ fat $\to$ anterior rectus sheath $\to$ rectus abdominis muscle $\to$ posterior rectus sheath $\to$ parietal peritoneum $\to$ cavity), anatomically grounded front-view torso (colon, small bowel, bladder, deep cuff in muscle, subcutaneous tunnel, downward-facing exit, curled pelvic tip), 5 interactive anatomy hotspots, and rebuilt vector figures across all 8 journey steps.
2. **8-Stage Bedside Percutaneous Sequence:** Grounded in the Komenda/Manitoba bedside percutaneous technique with play/pause/replay controls, individual stage selection, and automated `.route` guidewire motion animation (with strict WCAG `prefers-reduced-motion: reduce` compliance).
3. **10-Step Real Clinical Photo Reference:** Accessible via an opt-in sensitive content warning gate (`assets/clinical/step-1` to `step-10`), illustrating sterile drapes, 18G needle puncture, saline hydrodissection cushion, J-tip guidewire feeding, dilator & peel-away sheath conduit advancement, Dacron cuff seating, rigid stylet pelvic positioning, split-sheath removal with subcutaneous tunneling, fluid flow patency testing, and the completed catheter assembly with titanium adapter and minicap.
4. **Command Hospital (SC) Pune Informed Consent & Decision Companion:** Incorporates military and civilian admission fields (Service No, Rank, Unit, HID No, Ward, Diagnosis, Clinician), 4-tier risk stratification (immediate, delayed infectious, technical/mechanical, anesthetic), 4-question comprehension quiz with real-time feedback, 6 statutory declarations (including Open Mini-Laparotomy contingency authorization), capacity assessment protocol, 4-party physical signature lines, and offline single-page A4 PDF generation.
5. **Complete Trilingual Localization (English, हिन्दी, मराठी):** Seamless one-click language toggle between English, Hindi, and Marathi across the entire tool — including educational journey phases, layered anatomical vector diagrams, quiz check-ins, clinical instruction handouts, photo gallery descriptions, and Command Hospital Pune consent modules.

## Privacy & PHI Disclosure on Shared Devices

- **In-Memory Operation Only:** Patient identifiers entered in the Informed Consent Companion (name, age, Service No, Rank, Unit, MRN/HID, ward, clinician) exist purely in local browser memory.
- **Zero Transmission & Zero Persistence:** The tool makes zero network requests, uses no server backends or analytics, and stores no cookies or localStorage data.
- **Shared Clinic Device Protocol:** All patient data is immediately purged upon browser tab refresh or clicking "Start a fresh journey". Clinicians and nursing staff on shared hospital computers or tablets must refresh the page or click "Start a fresh journey" between patients to prevent inadvertent disclosure of Protected Health Information (PHI).

## Local Clinical Configuration

Edit `CLINIC_CONFIG` at the start of the JavaScript in `index.html`:

| Field | What the center should confirm |
| --- | --- |
| `centerName`, `phone`, `afterHoursPhone` | Service name and working daytime/after-hours contact routes. Blank numbers deliberately request the clinic's number instead of displaying a fictional one. |
| `markingInstructions` | Instructions for the pre-procedure marking appointment in upright sitting/standing postures, avoiding belt line, skin folds, and scars. |
| `fastingInstructions`, `medicationInstructions`, `bowelInstructions`, `arrivalInstructions` | Individual preparation, medicines, constipation prevention, bladder emptying, arrival, and accompaniment. |
| `dischargeInstructions` | Observation, eligibility to go home, transport and supervision after sedation. |
| `dialysisStartInstructions` | Planned break-in healing interval (ISPD guideline: **at least 2 weeks when possible** to allow tissue ingrowth into Dacron cuffs). |
| `dressingInstructions`, `dailyCareInstructions` | Early dressing protection; daily exit-site inspection and cleaning routines. |
| `activityInstructions`, `bathingInstructions` | Lifting limits, shower safety guidelines, and swimming precautions. |
| `reviewedBy`, `reviewDate` | Local review attribution. |

## Clinical References

- **ISPD Guidelines:**
  - [Creating and maintaining optimal peritoneal dialysis access in the adult patient: 2019 update](https://doi.org/10.3747/pdi.2018.00232)
  - [ISPD catheter-related infection recommendations: 2023 update](https://doi.org/10.1177/08968608231172740)
  - [ISPD peritonitis guideline recommendations: 2022 update](https://doi.org/10.1177/08968608221080586)
- **Bedside Technique Video Reference:**
  - [UKidney — Peritoneal dialysis catheter insertion at the bedside](https://ukidney.com/youtubule-nephrology-videos/137-peritoneal-dialysis-videos/1764-peritoneal-dialysis-catheter-insertion-at-the-bedside) (Komenda/Manitoba percutaneous technique)

## Verification Suites

To run all automated verification tests:

```sh
PLAYWRIGHT_MODULE="/Users/sachinsrivastava/Downloads/PD Prahari New/node_modules/playwright" \
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
node verification/check.cjs

node verification/verify-consent.cjs
node verification/verify-mobile.cjs
node verification/verify-languages.cjs
node verification/verify-illustrations.cjs
```

The illustration checks cover all eight figures in three languages, normal and enlarged text, and desktop/mobile widths, plus callout placement, connected fluid paths, and visible cuff-healing stages. They use the same `PLAYWRIGHT_MODULE` and `CHROME_PATH` settings as `check.cjs`.
