# Workday AutoFill AI — AI Integration Strategy

This document details the AI model selection, prompts, JSON schemas, confidence scoring rules, safety guardrails, and cost optimization techniques utilized by the extension.

---

## 1. AI Model Selection & Rationale

* **Selected Model**: Google Gemini (`gemini-3.5-flash-lite`) via the Google AI REST API (`generativelanguage.googleapis.com`).
* **Why `gemini-3.5-flash-lite`?**:
  1. **Low Latency & High Speed**: Delivers step-mapping completions in under 1 second, keeping application execution fast.
  2. **Native JSON Schema Enforcement**: Supports `responseMimeType: "application/json"` and `responseSchema` definitions, guaranteeing deterministic JSON structures without parsing errors.
  3. **Cost Efficiency**: Priced at a fraction of larger reasoning models while maintaining high accuracy for context-aware text extraction and classification.

---

## 2. Resume Parsing Strategy & Prompting

When a user uploads a resume (PDF, DOCX, or TXT), `resumeParser.js` extracts raw text and sends a single parsing request to the Gemini API.

### Structured Output Schema
The request uses `responseSchema` to enforce the structured JSON representation:

```json
{
  "name": { "first": "John", "middle": null, "last": "Doe" },
  "email": "john.doe@example.com",
  "phone": { "countryCode": "+1", "number": "5550199" },
  "address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "California",
    "postalCode": "94105",
    "country": "United States of America"
  },
  "links": { "linkedin": "https://linkedin.com/in/johndoe", "github": null, "portfolio": null },
  "experience": [
    {
      "jobTitle": "Software Engineer",
      "company": "Tech Corp",
      "startDate": "2021-06-01",
      "endDate": null,
      "current": true,
      "description": "Developed cloud services..."
    }
  ],
  "education": [
    {
      "school": "State University",
      "degree": "Bachelor of Science",
      "fieldOfStudy": "Computer Science",
      "startDate": "2017-09-01",
      "endDate": "2021-05-15"
    }
  ],
  "skills": ["JavaScript", "React", "Node.js", "Python"],
  "certifications": []
}
```

### Resume Extraction System Instruction:
> *"Extract resume data into this exact JSON schema. Normalize all dates to ISO 8601 (YYYY-MM-DD). If a field is not found, use null for scalars and empty arrays for arrays. Split name into first/middle/last. Include country code for phone. For experience and education, use the most recent entries (up to 5)."*

---

## 3. Batched Field-Mapping Strategy & Prompting

Instead of dispatching one API request per form field (which incurs high latency and API overhead), `mapper.js` collects all unresolved fields on the current step and dispatches a single batched payload.

### Batched Request Format:
```json
{
  "fields": [
    {
      "automationId": "formField-question-1024",
      "label": "Do you have experience with cloud deployments?",
      "type": "dropdown",
      "options": ["Yes", "No"],
      "required": true
    }
  ],
  "resume": { /* Parsed Resume Profile JSON */ }
}
```

### System Prompt & Behavioral Rules:
```text
You are a job application field mapper. Match resume data to form fields.
Return JSON: {"mappings":[{"fieldId":"automationId","value":"string","confidence":0.0,"reasoning":"string"}]}
Rules:
- Only fill a field if the resume explicitly contains data supporting the answer
- Do NOT use default assumptions for yes/no questions (work authorization, sponsorship, availability) unless the resume states it
- If unsure, confidence < 0.75
- For dropdowns, return an exact member of options when options are provided
```

---

## 4. Confidence Thresholds & Decision Logic

Every mapped field decision is evaluated against explicit confidence scoring boundaries:

| Confidence Range | Action Taken | UI Treatment |
| :--- | :--- | :--- |
| $\ge 0.75$ | **Autofill** field automatically | Displayed in review table as green/successful |
| $< 0.75$ | **Flag for Manual Review**; leave field empty | Displayed in review table as orange/flagged with reasoning |
| `0.0` (Blocked) | **Do Not Fill**; leave field empty | Flagged in review table requiring manual user input |

---

## 5. Strict Guardrails & Safety Protocols

To ensure ethical automation and prevent hallucinated application answers, the extension enforces three strict rules:

### Rule 1: Voluntary EEO & Protected Characteristics Override
* The extension **never infers or attempts to answer** protected characteristics (gender, race, ethnicity, veteran status, disability status).
* `mapper.js` intercepts all EEO fields before AI processing and sets the value to a standard decline-to-answer option (e.g., `"Prefer not to answer"` or `"I do not wish to answer"`).
* **Manual Override**: If the user wants to disclose, they can manually select their choice on the page or during review.

### Rule 2: Ambiguous / Missing Resume Signals Blocked
* Any field requiring information that cannot be directly proven from the resume text is **blocked from AI inference** (`canInferFromResume()` in `mapper.js`).
* The following topics are automatically set to `method: "inference_blocked"` with `confidence: 0` and left **BLANK**:
  - Visa sponsorship / CPT / OPT status
  - Work authorization specifics
  - Availability dates & holiday/weekend preferences
  - Non-compete or non-solicitation agreement confirmations
  - Quantified leadership/team size metrics not stated in the resume
  - Referral sources or employee referral details

### Rule 3: Terms & Conditions Checkboxes
* Terms of service, privacy consents, and agreement checkboxes are **never auto-checked by AI or background automation**.
* They are left unchecked for explicit user review and manual confirmation prior to final submission.

---

## 6. Cost & Performance Optimization

* **Step Batching**: By grouping all fields per step into one API call, a typical 5-step Workday application requires only **4 to 6 total API calls** (1 for resume parsing + 3–5 for unresolved step fields).
* **Tier 1 & Tier 2 Bypass**: Because ~75–90% of fields are resolved via deterministic IDs and synonyms, the AI payload contains only a small subset of fields per step.
* **Estimated Cost Per Run**: 
  - **Resume Parsing**: ~1,500 input tokens / ~500 output tokens ($\approx \$0.00015$)
  - **Step Mapping**: ~2,000 input tokens / ~300 output tokens total ($\approx \$0.00020$)
  - **Total Cost per Application**: Less than **\$0.0005 USD** (half a tenth of a cent).
