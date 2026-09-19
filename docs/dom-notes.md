# Target Workday DOM Notes

> **Posting**: ETL GM - Food Sales (R0000452117)
> **URL**: `https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/3308-N-Dinuba-Blvd%2C-Visalia%2CCA-93291-8718/ETL-GM---Food-Sales_R0000452117/apply`
> **Generated**: 2026-09-17

---

## 1. Scope

This document normalizes reconnaissance data from 5 JSON snapshots of a Target Workday job application. It covers:

- Application flow and page structure
- Field registry with automation IDs
- Widget patterns and interaction models
- Selector strategy and stability assessment
- Known anomalies and verification requirements

---

## 2. Application Flow

The application follows a 4-step linear flow with a review/validation state:

```
Step 1: My Information
    ↓
Step 2: My Experience
    ↓
Step 3: Application Questions
    ↓
Step 4: Voluntary Disclosures
    ↓
Review / Submit (same page as Step 4)
```

**Reconnaissance coverage**:

| Step | File | Elements | Timestamp |
|------|------|----------|-----------|
| My Information | `my-information.json` | 59 | 07:05:48 |
| My Experience | `my-experience.json` | 23 | 07:07:44 |
| Application Questions | `application-questions.json` | 59 | 07:10:30 |
| Voluntary Disclosures | `voluntary-disclosures.json` | 20 | 07:10:59 |
| Review (snapshot) | `review.json` | 24 | 07:11:52 |

---

## 3. Page Anchors

Each step is identified by a `data-automation-id` on the page container:

| Step | `automationId` | Status |
|------|----------------|--------|
| My Information | `applyFlowMyInfoPage` | OBSERVED |
| My Experience | `applyFlowMyExpPage` | OBSERVED |
| Application Questions | `applyFlowPrimaryQuestionsPage` | OBSERVED |
| Voluntary Disclosures | `applyFlowVoluntaryDisclosuresPage` | OBSERVED |
| Review | `applyFlowVoluntaryDisclosuresPage` | OBSERVED (same as Voluntary Disclosures) |

**Ambiguity**: The Review step shares the same `automationId` as Voluntary Disclosures. The review snapshot contains additional elements (`applyFlowPage`, `errorHeading` x3) not present in the Voluntary Disclosures snapshot, suggesting validation errors were triggered.

**Progress Bar**: `data-automation-id="progressBar"`
- `progressBarCompletedStep` — completed steps
- `progressBarActiveStep` — current step
- `progressBarInactiveStep` — future steps

---

## 4. Field Registry

### My Information (`applyFlowMyInfoPage`)

| Label | automationId | Widget | Required | Status | Stability |
|-------|--------------|--------|----------|--------|-----------|
| How Did You Hear About Us | `formField-source` | multiselect | Yes | OBSERVED | HIGH |
| Previously worked at Target | `formField-candidateIsPreviousWorker` | radio | Yes | OBSERVED | HIGH |
| Country | `formField-country` | dropdown | Yes | OBSERVED | HIGH |
| First Name | `formField-legalName--firstName` | text | Yes | OBSERVED | HIGH |
| Middle Name | `formField-legalName--middleName` | text | No | OBSERVED | HIGH |
| Last Name | `formField-legalName--lastName` | text | Yes | OBSERVED | HIGH |
| Local Given Name(s) | `formField-legalName--firstNameLocal` | text | No | OBSERVED | HIGH |
| Local Middle Name | `formField-legalName--middleNameLocal` | text | No | OBSERVED | HIGH |
| Local Family Name | `formField-legalName--lastNameLocal` | text | No | OBSERVED | HIGH |
| I have a preferred name | `formField-preferredCheck` | checkbox | No | OBSERVED | HIGH |
| Preferred First Name | `formField-preferredName--firstName` | text | Yes | INFERRED | HIGH |
| Preferred Middle Name | `formField-preferredName--middleName` | text | No | INFERRED | HIGH |
| Preferred Last Name | `formField-preferredName--lastName` | text | Yes | INFERRED | HIGH |
| Preferred Local Given Name(s) | `formField-preferredName--firstNameLocal` | text | No | INFERRED | HIGH |
| Preferred Local Middle Name | `formField-preferredName--middleNameLocal` | text | No | INFERRED | HIGH |
| Preferred Local Family Name | `formField-preferredName--lastNameLocal` | text | No | INFERRED | HIGH |
| Address Line 1 | `formField-addressLine1` | text | Yes | OBSERVED | HIGH |
| City | `formField-city` | text | Yes | OBSERVED | HIGH |
| Postal Code | `formField-postalCode` | text | Yes | OBSERVED | HIGH |
| State | `formField-countryRegion` | dropdown | Yes | OBSERVED | HIGH |
| Email Address | — | text | Yes | UNKNOWN | — |
| Phone Device Type | `formField-phoneType` | dropdown | Yes | OBSERVED | HIGH |
| Country Phone Code | `formField-countryPhoneCode` | multiselect | Yes | OBSERVED | HIGH |
| Phone Number | `formField-phoneNumber` | text | Yes | OBSERVED | HIGH |
| Phone Extension | `formField-extension` | text | No | OBSERVED | HIGH |
| SMS opt-in | `phone-sms-opt-in` | checkbox | No | OBSERVED | HIGH |

**Note**: Email Address field was not captured in recon. The `formField-emailAddress` automationId is INFERRED from manual notes.

### My Experience (`applyFlowMyExpPage`)

| Label | automationId | Widget | Required | Status | Stability |
|-------|--------------|--------|----------|--------|-----------|
| Job Title | `formField-jobTitle` | text | Yes | INFERRED | HIGH |
| Company | `formField-companyName` | text | Yes | INFERRED | HIGH |
| I currently work here | `formField-currentlyWorkHere` | checkbox | No | INFERRED | HIGH |
| From (Start Date) | `formField-startDate` | text | Yes | INFERRED | HIGH |
| Role Description | `formField-roleDescription` | textarea | No | INFERRED | HIGH |
| School or University | `formField-schoolName` | text | Yes | INFERRED | HIGH |
| Degree | `formField-degree` | dropdown | Yes | INFERRED | HIGH |
| Field of Study | `formField-fieldOfStudy` | dropdown | No | INFERRED | HIGH |
| Skills | `formField-skills` | multiselect | Yes | OBSERVED | HIGH |
| Resume/CV | `file-upload-input-ref` | file | No | OBSERVED | HIGH |

**Note**: Work Experience, Education, and Languages fields were NOT captured in the recon JSON. The automationIds above are INFERRED from manual notes.

### Application Questions (`applyFlowPrimaryQuestionsPage`)

| Label | automationId | Widget | Required | Status | Stability |
|-------|--------------|--------|----------|--------|-----------|
| Legally authorized for employment in US | `formField-99a144b35c58100c669eb32100ae0000` | button | Yes | OBSERVED | LOW |
| Require sponsorship for work authorization | `formField-ef7884e71940100c671bedb64ee80000` | button | Yes | OBSERVED | LOW |
| Authorization involve CPT or OPT | `formField-80f5be2af5ab100c6731fdf6d8e10000` | button | Yes | OBSERVED | LOW |
| Employment agreement / restrictions | `formField-99a144b35c58100c669eb3bbb5bb0000` | button | Yes | OBSERVED | LOW |
| Non-compete / non-solicitation agreement | `formField-99a144b35c58100c669eb3bbb5bb0003` | button | Yes | OBSERVED | LOW |
| Currently a Target team member | `formField-99a144b35c58100c669eb3bbb5bb0006` | button | Yes | OBSERVED | LOW |
| Contractor with Target in past 12 months | `formField-99a144b35c58100c669eb3bbb5bb0009` | button | Yes | OBSERVED | LOW |
| Referred by workforce/staffing agency | `formField-99a144b35c58100c669eb45709ed0002` | button | Yes | OBSERVED | LOW |
| Open to relocation | `formField-99a144b35c58100c669eb45709ed0006` | button | Yes | OBSERVED | LOW |
| General availability | `formField-99a144b35c58100c669eb4f2cb580001` | checkbox_group | Yes | OBSERVED | LOW |
| Available to work weekends/holidays | `formField-99a144b35c58100c669eb4f2cb580006` | button | Yes | OBSERVED | LOW |
| Type of leadership experience | `formField-99a144b35c58100c669eb58e0d0b0000` | button | Yes | OBSERVED | LOW |
| Size of teams led | `formField-99a144b35c58100c669eb58e0d0b0006` | button | Yes | OBSERVED | LOW |
| Years leading a team | `formField-99a144b35c58100c669eb629e01f0003` | button | Yes | OBSERVED | LOW |
| Years hiring/building sales teams | `formField-99a144b35c58100c669eb629e01f0008` | button | Yes | OBSERVED | LOW |
| Years coaching/developing teams | `formField-99a144b35c58100c669eb6c3a2380002` | button | Yes | OBSERVED | LOW |

**Checkbox Group** (General Availability):
- Group automationId: `99a144b35c58100c669eb4f2cb580001-CheckboxGroup`
- Options: Days, Evenings, Overnight, Weekends
- Individual checkbox IDs: UUID-based (unstable)
- Option identification: by `labelText`

### Voluntary Disclosures (`applyFlowVoluntaryDisclosuresPage`)

| Label | automationId | Widget | Required | Status | Stability |
|-------|--------------|--------|----------|--------|-----------|
| Gender | `formField-gender` | dropdown | Yes | OBSERVED | HIGH |
| Race | `formField-ethnicity` | dropdown | Yes | OBSERVED | HIGH |
| Hispanic or Latino | `formField-hispanicOrLatino` | dropdown | No | OBSERVED | HIGH |
| Accept terms and conditions | `formField-acceptTermsAndAgreements` | checkbox | Yes | OBSERVED | HIGH |

### Review / Validation

| Element | automationId | Widget | Status | Stability |
|---------|--------------|--------|--------|-----------|
| Apply flow page | `applyFlowPage` | button | OBSERVED | HIGH |
| Error heading 1 | `errorHeading` | button | OBSERVED | HIGH |
| Error heading 2 | `errorHeading` | button | OBSERVED | HIGH |
| Error heading 3 | `errorHeading` | button | OBSERVED | HIGH |

---

## 5. Widget Patterns

### Text Input

**Identification**:
- `tagName: "input"` with `type: "text"`
- `automationId: "formField-*"`
- Often paired with a `<div>` wrapper sharing the same `automationId`

**Fields using this pattern**:
- Legal Name (firstName, middleName, lastName, firstNameLocal, middleNameLocal, lastNameLocal)
- Address (addressLine1, city, postalCode)
- Phone (phoneNumber, extension)
- Skills search input
- Application Question hidden inputs

**Interaction**: Use `nativeInputValueSetter` + dispatch input/change/blur events.

### Dropdown (Button-Based)

**Identification**:
- `tagName: "button"` with `type: "button"`
- `automationId: "formField-*"`
- `ariaLabel` contains current value + "Required"
- Hidden `<input>` with same `automationId` (isVisible: false)

**Fields using this pattern**:
- Country
- State (countryRegion)
- Phone Device Type
- Gender
- Race (ethnicity)
- Hispanic or Latino
- Application Questions (single-select)

**Interaction**: Click button → wait for listbox popup → click matching option → verify ariaLabel updates.

### Searchable Multiselect

**Identification**:
- Container: `automationId: "multiSelectContainer"` with `widgetType: "multiselect"`
- Search input: `automationId: "multiselectInputContainer"` with `placeholder: "Search"`
- Selected items: `automationId: "selectedItemList"` with `role: "listbox"`
- Selected pill: `automationId: "selectedItem"` with `role: "option"`
- Dropdown items: `automationId: "menuItem"` with `role: "presentation"`

**Fields using this pattern**:
- How Did You Hear About Us (source)
- Country Phone Code
- Skills

**Interaction**: Type in search input → wait for dropdown → click option → verify pill appears.

### Button-Based Question (UUID)

**Identification**:
- `tagName: "button"` with `type: "button"`
- `automationId: "formField-{32-char-hex-UUID}"`
- `id: "primaryQuestionnaire--{UUID}"`
- `ariaLabel` contains current answer + "Required"
- Hidden `<input>` with same `automationId` (isVisible: false)
- Question text is NOT inside the element

**Fields using this pattern**:
- All 16 Application Questions

**Interaction**: Click button → select answer from popup → verify ariaLabel updates.

**Stability**: LOW — UUIDs are generated per session.

### Checkbox Group

**Identification**:
- Multiple `<input type="checkbox">` elements
- Shared `automationId: "{baseId}-CheckboxGroup"`
- Individual `id` attributes are UUID-based (unstable)
- Labels identified by `labelText`

**Fields using this pattern**:
- General Availability (Days, Evenings, Overnight, Weekends)

**Interaction**: Click each checkbox to toggle. Verify `checked` state.

### Radio

**Identification**:
- `<input type="radio">` with same `name` attribute
- Container: `automationId: "formField-*"` with `data-fkit-id`
- Individual `id` attributes are generated (unstable)
- Labels identified by `labelText`

**Fields using this pattern**:
- Previously worked at Target (Yes/No)

**Interaction**: Click the radio input for the desired option. Verify `checked` state.

### File Upload

**Identification**:
- Hidden input: `automationId: "file-upload-input-ref"` with `type: "file"`
- Select button: `automationId: "select-files"`
- Drop zone: `automationId: "file-upload-drop-zone"`
- Delete button: `automationId: "delete-file"` (appears after upload)
- Wrapper: `data-fkit-id: "resumeAttachments--attachments"`

**Fields using this pattern**:
- Resume/CV upload

**Interaction**: Set files on hidden `<input type="file">` via DataTransfer + dispatch change event. Or drag & drop onto drop zone.

---

## 6. Conditional Sections

### Preferred Name

**Trigger**: `formField-preferredCheck` (checkbox)
**Condition**: When checked, reveals Preferred Name fields
**Status**: INFERRED — manual notes confirm "checkbox if ticked, the below Preferred Name blocks opens up"

**Revealed fields**:
- `formField-preferredName--firstName`
- `formField-preferredName--middleName`
- `formField-preferredName--lastName`
- `formField-preferredName--firstNameLocal`
- `formField-preferredName--middleNameLocal`
- `formField-preferredName--lastNameLocal`

---

## 7. Repeatable Sections

### Work Experience

**Add control**: `automationId: "add-button"` (1st of 3)
**Fields per entry**:
- `formField-jobTitle` (text, required)
- `formField-companyName` (text, required)
- `formField-currentlyWorkHere` (checkbox)
- `formField-startDate` (text, required)
- `formField-roleDescription` (textarea)

**Status**: INFERRED — fields not captured in recon JSON

### Education

**Add control**: `automationId: "add-button"` (2nd of 3)
**Fields per entry**:
- `formField-schoolName` (text, required)
- `formField-degree` (dropdown, required)
- `formField-fieldOfStudy` (dropdown)

**Status**: INFERRED — fields not captured in recon JSON

### Languages

**Add control**: `automationId: "add-button"` (3rd of 3)
**Fields per entry**: UNKNOWN — no field data captured

---

## 8. Navigation

### Footer Navigation

| Button | automationId | Visibility | Status |
|--------|--------------|------------|--------|
| Back | `pageFooterBackButton` | Steps 2-4 | OBSERVED |
| Next / Save and Continue | `pageFooterNextButton` | All steps | OBSERVED |

### Site Navigation (Ignore for Automation)

| Element | automationId | Notes |
|---------|--------------|-------|
| Back to Job Posting | `backToJobPosting` | role="link" |
| Search for Jobs | `navigationItem-Search for Jobs` | Site nav |
| Candidate Home | `navigationItem-Candidate Home` | Site nav (misclassified) |
| Main Menu | `hammyMenuIcon` | Hidden, mobile only |
| Language Selector | `utilityMenuButton` (id: languageSelectorButton) | Ignore |
| Settings | `utilityMenuButton` (id: settingsSelectorButton) | Ignore |
| Account | `utilityMenuButton` (id: accountSettingsButton) | Ignore |

---

## 9. Validation

**Error elements detected**: 3 hidden `errorHeading` buttons in review snapshot

**Actual validation behavior**: UNKNOWN — error elements were hidden during recon. The automation engine should monitor for these elements becoming visible after clicking Next/Submit.

**Implementation note**: The automation engine should be prepared for dynamically rendered error messages when validation fails.

---

## 10. Dynamic DOM Behavior

Based on the reconnaissance data:

1. **Repeatable sections**: Clicking `add-button` likely appends new field sets to the DOM
2. **Dropdown popups**: Button dropdowns create listbox popups dynamically
3. **Multiselect dropdowns**: Search input triggers dynamic dropdown rendering
4. **Conditional fields**: Checkbox toggle reveals/hides field sections
5. **Error display**: Validation errors may insert/modify DOM elements

**Implementation note**: The automation engine should be prepared for dynamically rendered or replaced DOM nodes, particularly for repeatable sections and popup widgets.

---

## 11. Selector Strategy

### Priority Order

1. `data-automation-id` — **Primary selector.** Most stable, most documented.
2. `id` — Stable when present (e.g., `name--legalName--firstName`). Unstable for UUIDs.
3. `name` — Present on some inputs (e.g., `legalName--firstName`). Stable.
4. `data-fkit-id` — On containers. Useful for locating field groups.
5. `data-uxi-widget-type` — For widget classification (e.g., `selectinput`, `multiselect`).
6. `aria-label` — On buttons, contains current selected value.
7. Label text — Fallback for matching fields.

### Unstable Identifiers

Avoid relying on:
- UUID-based `id` values (e.g., `bgp22`, `585ff4f3103c017dc274e0d4fe089f34-*`)
- CSS classes (not captured, likely generated)
- `nth-child` selectors (fragile across renders)
- DOM position (fields may reorder)
- `data-uxi-multiselect-id` (UUID-based)
- `data-uxi-element-id` (UUID-based)

---

## 12. Known Anomalies

### candidateIsPreviousWorker Misclassification

**Inspector classification**: `date_picker`
**Observed structure**: Two `<input type="radio">` elements with labels "Yes" and "No"
**Normalized widget**: `radio`
**Status**: Verified correction

### navigationItem-Candidate Home Misclassification

**Inspector classification**: `date_picker`
**Observed structure**: `<button>` element with no date-related attributes
**Normalized widget**: `button` (site navigation)
**Status**: Verified correction

### Duplicate Elements Per Field

**Pattern**: Most fields have both an `<input>` and a `<div>` with the same `automationId`
**Example**: `formField-legalName--firstName` appears on both `<input>` (isVisible: true) and `<div>` (isVisible: true)
**Recommendation**: Treat as one logical field. Prefer the `<input>` for filling.

### Hidden Inputs with Visible Wrappers

**Pattern**: Many `<input>` elements report `isVisible: false` while their sibling `<div>` with the same `automationId` is visible
**Examples**: All radio buttons, all checkbox inputs, all dropdown hidden inputs
**Recommendation**: When `isVisible: false` for an input, check if a sibling div with the same automationId is visible. The field IS interactable.

### Review Step Ambiguity

**Observation**: Review snapshot has same `automationId` as Voluntary Disclosures (`applyFlowVoluntaryDisclosuresPage`)
**Difference**: Review snapshot contains additional elements (`applyFlowPage`, `errorHeading` x3)
**Recommendation**: Detect review state by presence of `applyFlowPage` element or `errorHeading` elements

---

## 13. Manual Verification Required

### Email Address Field

**Unknown**: automationId not captured in recon
**Why it matters**: Cannot automate without stable selector
**Verify**: Open field manually and inspect DOM for `data-automation-id`

### Start Date Widget Type

**Unknown**: text input vs date picker
**Why it matters**: Automation interaction depends on widget type
**Verify**: Open field manually and observe the interaction/DOM

### Button Dropdown Popup Behavior

**Unknown**: How dropdowns open and render options
**Why it matters**: Must wait for correct DOM state before selecting
**Verify**: Click dropdown button and observe listbox creation

### Repeatable Section Add Behavior

**Unknown**: What DOM mutation occurs after clicking Add
**Why it matters**: Must locate newly added fields correctly
**Verify**: Click Add button and observe DOM changes

### Submit Button Behavior

**Unknown**: Is `pageFooterNextButton` the submit on final step?
**Why it matters**: Must distinguish between navigation and submission
**Verify**: Complete all steps and observe final button behavior

### Validation Error Display

**Unknown**: How errors appear when required fields are missing
**Why it matters**: Must detect and handle validation failures
**Verify**: Submit with missing required fields and observe error display

### Work Experience / Education / Languages Fields

**Unknown**: Exact field structure and automationIds
**Why it matters**: Cannot automate these sections without field data
**Verify**: Navigate to My Experience and capture field DOM

---

## 14. Confidence / Evidence Notes

### High Confidence (OBSERVED)

- All text input fields in My Information
- All dropdown fields (Country, State, Phone Type, EEO)
- Searchable multiselects (Source, Country Phone Code, Skills)
- File upload elements
- Application Question buttons and checkbox groups
- Terms and conditions checkbox
- Navigation controls

### Medium Confidence (INFERRED)

- Preferred Name fields (from manual notes, not in recon)
- Work Experience fields (from manual notes, not in recon)
- Education fields (from manual notes, not in recon)
- Email Address field (from manual notes, not in recon)

### Low Confidence (UNKNOWN)

- Languages section (no field data)
- Submit button behavior
- Validation error display
- Repeatable section add behavior
- Dropdown popup interaction

---

## Recon Source

**Generated from**:
- `recon/my-information.json`
- `recon/my-experience.json`
- `recon/application-questions.json`
- `recon/voluntary-disclosures.json`
- `recon/review.json`
- `docs/notes.md` (manual notes)

**Generation date**: 2026-09-17

**Important**: This document is a normalized interpretation of the reconnaissance data. The raw reconnaissance files remain the source evidence. Items marked INFERRED or UNKNOWN require manual verification before implementation.
