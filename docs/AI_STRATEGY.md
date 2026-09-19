# Workday AutoFill AI - AI Strategy

## Overview

The extension uses OpenAI's GPT-4o-mini model for two primary functions:
1. Resume parsing (structured data extraction)
2. Field mapping (semantic matching)

## Resume Parsing

### Prompt Strategy
- System prompt defines exact JSON schema
- Uses `response_format: json_schema` for guaranteed valid output
- Raw resume text sent as user message

### Schema
```json
{
  "name": { "first": "", "middle": null, "last": "" },
  "email": "",
  "phone": { "countryCode": "+1", "number": "" },
  "address": { "line1": "", "city": "", "state": "", "postalCode": "", "country": "US" },
  "links": { "linkedin": "", "github": "", "portfolio": "" },
  "experience": [{ "jobTitle": "", "company": "", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD|null", "current": false, "description": "" }],
  "education": [{ "school": "", "degree": "", "fieldOfStudy": "", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }],
  "skills": [""],
  "certifications": [""]
}
```

### Key Decisions
- Name pre-split into first/middle/last (Workday requires atomic fields)
- Dates normalized to ISO 8601
- Phone split into country code and number
- Null for missing fields (not empty strings)
  
## Field Mapping

### Three-Tier Resolution

#### Tier 1: Deterministic (Confidence: 1.0)
Direct mapping from `data-automation-id` to profile path.

```javascript
const AUTOMATION_ID_MAP = {
  'formField-legalName--firstName': 'name.first',
  'formField-legalName--lastName': 'name.last',
  'formField-addressLine1': 'address.line1',
  // ... ~30 entries
};
```

**Cost**: Zero API calls
**Coverage**: ~60-80% of fields

#### Tier 2: Heuristic (Confidence: 0.8)
Synonym-based label matching.

```javascript
const SYNONYMS = {
  'given name': 'firstName',
  'forename': 'firstName',
  'surname': 'lastName',
  'mobile': 'phone',
  // ... ~50 entries
};
```

**Cost**: Zero API calls
**Coverage**: ~10-15% of fields

#### Tier 3: AI (Confidence: Variable)
Batch per-step API call for unresolved fields.

**Prompt**:
```
You are a job application field mapper. Match resume data to form fields.
Return a JSON array of objects with: fieldId, value, confidence, reasoning.
Rules:
- Only fill fields you are confident about (confidence >= 0.75)
- For dropdown fields, return an exact match from the options list
- For Yes/No questions, use "Yes" or "No" exactly
- Do not infer protected characteristics (gender, race, ethnicity)
- For voluntary/EEO questions, return value "I don't wish to answer"
```

**Input**:
```json
{
  "fields": [
    {"automationId": "formField-xxx", "label": "Are you legally authorized?", "type": "dropdown", "options": ["Yes", "No"], "required": true}
  ],
  "resume": { ... }
}
```

**Output**:
```json
[
  {"fieldId": "formField-xxx", "value": "Yes", "confidence": 0.95, "reasoning": "Resume shows US address and work history"}
]
```

**Cost**: ~1 API call per step (~4 calls total)
**Coverage**: ~10-20% of remaining fields

### Confidence Thresholds
- **≥ 0.9**: Auto-fill with high confidence
- **0.75 - 0.9**: Auto-fill with normal confidence
- **< 0.75**: Flag for user review (not filled)

## Question Answering

### Only Answer When Resume Explicitly Supports It
- Work authorization → Only if resume states citizenship, visa status, or work authorization
- Sponsorship required → Only if resume states nationality/visa type
- Open to relocation → Only if resume/profile explicitly says so
- Available weekends/holidays → Never auto-fill (personal preference, not inferrable)

### Safe Defaults (No Resume Signal Needed)
- Previously worked at Target → "No" (negligible downside)

### Default to "I don't wish to answer" (EEO/Voluntary)
- Gender, Race/Ethnicity, Veteran status, Disability status

### Always Flag (Never Auto-Fill)
- Leadership experience descriptions
- Years of specific experience
- Availability specifics
- Non-compete questions
- Work authorization/sponsorship (unless explicitly stated in resume)

## API Usage Optimization

- Batch all unresolved fields per step into single API call
- Cache successful mappings in `chrome.storage.local`
- Use `gpt-4o-mini` for cost efficiency
- Average cost per application: ~$0.02-0.05

## Error Handling

- Invalid JSON response → retry once, then flag fields
- API rate limit → wait and retry
- Network error → flag fields, continue with deterministic/heuristic
- Low confidence → flag, never auto-fill
