# Workday AutoFill AI — System Limitations & Boundaries

This document defines the operational boundaries, intentionally non-automated workflows, security mitigations, and known edge cases of the extension.

---

## 1. Assessment & Skill Test Modules

* **Scope Limit**: Workday job applications occasionally include external or embedded assessment modules (e.g., timed coding tests, logical reasoning quizzes, video interviews, or personality assessments).
* **Behavior**: The extension **does not attempt to solve or complete assessment modules**.
* **User Action**: When an assessment step appears, the extension pauses and yields control to the applicant.

---

## 2. Intentional Omission of Uninferable Application Questions

* **Scope Limit**: Fields requiring information absent from standard resume documents are intentionally left un-filled.
* **Affected Question Types**:
  - Work authorization details (CPT, OPT, H-1B transfer timeline)
  - Work visa sponsorship requirements
  - Non-compete / non-solicitation agreement confirmations
  - Start date availability & shift/holiday preferences
  - Prior employment at specific subsidiary or parent companies
  - Referral sources or employee reference details
  - Specific quantified leadership numbers not explicitly present in the resume text
* **Behavior**: `mapper.js` detects these question patterns via `canInferFromResume()`, blocks AI mapping (`method: "inference_blocked"`), leaves the field **BLANK**, and flags it in the **Fill Review** panel.
* **User Action**: The applicant must manually answer flagged questions before proceeding.

---

## 3. Equal Employment Opportunity (EEO) & Voluntary Disclosures

* **Scope Limit**: Federal EEO and voluntary disclosure questions (gender, race, ethnicity, Hispanic/Latino origin, veteran status, disability status).
* **Behavior**: The extension **never infers or auto-selects affirmative choices** for demographic questions. It defaults all EEO fields to `"Prefer not to answer"` or `"Decline to answer"`.
* **User Action**: If the applicant wishes to self-disclose demographic information, they must manually select their preferences on the form or during review.

---

## 4. Missing Profile Data & Address Fields

* **Scope Limit**: Required fields (e.g., physical street address, emergency contact, phone extension) that are completely omitted from the uploaded resume.
* **Behavior**: The extension skips empty values and logs an incomplete field entry. It does not generate dummy addresses or synthetic placeholders.
* **User Action**: The applicant must enter missing personal information directly into the Workday portal.

---

## 5. Workday Tenant & Customization Variability

* **Scope Limit**: Workday UI layouts vary across different corporate tenants (e.g., Target, NVIDIA, custom enterprise portals).
* **Behavior**: 
  - The deterministic map (`AUTOMATION_ID_MAP`) and step detector (`STEP_IDS`) are optimized for standard Workday field automation IDs (`formField-legalName--firstName`, `applyFlowMyInfoPage`, `bottom-navigation-submit-button`).
  - Highly customized tenant templates with non-standard DOM structures or obscured data attributes rely on the heuristic and AI fallback layers, which may experience lower confidence scores.
* **Mitigation**: New tenant-specific automation IDs can be added to [constants.js](file:///D:/Hidani-Tech/src/lib/constants.js#L1).

---

## 6. Security, PII Handling & Privacy Mitigation

* **PII Transmission**: Resume text containing Personally Identifiable Information (PII) is sent to the Google Gemini API for parsing and step field mapping.
* **Privacy Mitigations**:
  - **User-Provided API Key**: The user supplies their own Gemini API key in the side panel settings.
  - **No Central Server**: The extension runs entirely locally in the user's browser; there is no intermediate backend server or proxy collecting user data.
  - **Local Storage Only**: API keys and parsed profile JSON are stored exclusively in `chrome.storage.local`.
  - **No Prompt Logging**: Requests are sent directly over HTTPS to Google Generative Language APIs with no third-party logging.

---

## 7. Authentication & Final Submission Guardrails

* **Login & Registration**: The extension **never automates login, password entry, or account creation**. If an authentication screen is detected, execution pauses until the user completes authentication.
* **Final Submission**: Final application submission is **never automatically clicked during autofill runs**. Submission requires the user to explicitly open the review tab, check the confirmation box, and click **Submit application**.
