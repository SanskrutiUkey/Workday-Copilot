import { AUTOMATION_ID_MAP, REPEATABLE_FIELD_MAP, SYNONYMS, EEO_DECLINE } from '../lib/constants.js';
import { getMappings, setMappings } from '../lib/store.js';

const SENSITIVE_PATTERNS = [
  { pattern: /authorized.*work|work.*authorization|legally.*authorized|eligibility to work/i, requires: ['citizenship', 'visaStatus', 'workAuthorization'] },
  { pattern: /sponsorship|sponsor/i, requires: ['citizenship', 'visaStatus', 'nationality'] },
  { pattern: /weekend|holiday|availability|cpt or opt|non-compete|non-solicitation|leadership|years (leading|hiring|coaching)|size of teams|relocation/i, requires: [] }
];

const EEO_PATTERN = /gender|race|ethnicity|hispanic|latino|veteran|disability|sex/i;

function canInferFromResume(label, resumeJson) {
  const text = label || '';
  if (EEO_PATTERN.test(text)) return true;
  for (const { pattern, requires } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      if (requires.length === 0) return false;
      return requires.some(field => resumeJson[field] || resumeJson.meta?.[field] || resumeJson.address?.[field]);
    }
  }
  return true;
}

export function resolveFieldPath(automationId, label) {
  if (automationId && AUTOMATION_ID_MAP[automationId]) {
    return { path: AUTOMATION_ID_MAP[automationId], confidence: 1.0, method: 'deterministic' };
  }

  if (label) {
    const normalized = label.toLowerCase().replace(/[*:]/g, '').trim();
    for (const [synonym, path] of Object.entries(SYNONYMS)) {
      if (normalized === synonym || normalized.includes(synonym)) {
        return { path, confidence: 0.8, method: 'heuristic' };
      }
    }
  }

  return { path: null, confidence: 0, method: 'unknown' };
}

export function getNestedValue(obj, path) {
  if (!path || !obj) return undefined;

  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

function pickEeoValue(options) {
  if (!options || !options.length) return EEO_DECLINE[0];
  for (const phrase of EEO_DECLINE) {
    const hit = options.find(o => o.toLowerCase().includes(phrase.toLowerCase()) || phrase.toLowerCase().includes(o.toLowerCase()));
    if (hit) return hit;
  }
  const fuzzy = options.find(o => /not.*answer|decline|prefer not/i.test(o));
  return fuzzy || EEO_DECLINE[0];
}

export async function mapFields(fields, resumeJson) {
  const cachedMappings = await getMappings();
  const results = [];
  const unresolved = [];

  for (const field of fields) {
    const { automationId, label, element, widgetType, options, section } = field;

    if (EEO_PATTERN.test(label || '') || ['formField-gender', 'formField-ethnicity', 'formField-hispanicOrLatino'].includes(automationId)) {
      results.push({
        element,
        value: pickEeoValue(options),
        automationId,
        label,
        widgetType,
        method: 'eeo_decline',
        confidence: 1.0
      });
      continue;
    }

    if (automationId === 'formField-acceptTermsAndAgreements') {
      results.push({
        element,
        value: resumeJson.meta?.acceptTerms === true,
        automationId,
        label,
        widgetType,
        method: 'terms',
        confidence: 1.0
      });
      continue;
    }

    if (cachedMappings[automationId]) {
      const cached = cachedMappings[automationId];
      const cachedPath = section && REPEATABLE_FIELD_MAP[section]?.[automationId]
        ? `${section}[0].${REPEATABLE_FIELD_MAP[section][automationId]}`
        : cached.path;
      const value = getNestedValue(resumeJson, cachedPath);
      if (value !== undefined && value !== null && value !== '') {
        results.push({
          element,
          value: Array.isArray(value) ? value : value,
          automationId,
          label,
          widgetType,
          method: 'cached',
          confidence: 1.0
        });
        continue;
      }
    }

    let path, confidence, method;
    if (section && REPEATABLE_FIELD_MAP[section]?.[automationId]) {
      const key = REPEATABLE_FIELD_MAP[section][automationId];
      path = `${section}[0].${key}`;
      confidence = 1.0;
      method = 'deterministic';
    } else {
      ({ path, confidence, method } = resolveFieldPath(automationId, label));
    }

    if (path && confidence >= 0.75) {
      let value = getNestedValue(resumeJson, path);
      if ((value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) && automationId === 'formField-endDate') {
        const currentPath = section ? `${section}[0].current` : 'experience[0].current';
        const isCurrent = getNestedValue(resumeJson, currentPath);
        if (isCurrent === true) {
          const now = new Date();
          value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          method = 'fallback_current_date';
        }
      }
      if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '') && !(Array.isArray(value) && value.length === 0)) {
        results.push({ element, value, automationId, label, widgetType, method, confidence });
        cachedMappings[automationId] = { path, method };
        continue;
      }
    }

    unresolved.push(field);
  }

  await setMappings(cachedMappings);

  if (unresolved.length > 0) {
    const aiResults = await aiMapFields(unresolved, resumeJson);
    results.push(...aiResults);
  }

  return results;
}

async function aiMapFields(fields, resumeJson) {
  const results = [];
  const aiableFields = [];

  for (const field of fields) {
    if (canInferFromResume(field.label, resumeJson)) {
      aiableFields.push(field);
    } else {
      results.push({
        element: field.element,
        value: null,
        automationId: field.automationId,
        label: field.label,
        widgetType: field.widgetType,
        method: 'inference_blocked',
        confidence: 0,
        reasoning: 'Resume lacks data to infer this answer — flagged for manual input'
      });
    }
  }

  if (aiableFields.length === 0) return results;

  const promptFields = aiableFields.map(f => ({
    automationId: f.automationId,
    label: f.label,
    type: f.widgetType,
    options: f.options || [],
    required: f.required
  }));

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AI_REQUEST',
      payload: {
        model: 'gemini-3.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ fields: promptFields, resume: resumeJson }) }] }],
        systemInstruction: {
          parts: [{
            text: `You are a job application field mapper. Match resume data to form fields.
Return JSON: {"mappings":[{"fieldId":"automationId","value":"string","confidence":0.0,"reasoning":"string"}]}
Rules:
- Only fill a field if the resume explicitly contains data supporting the answer
- Do NOT use default assumptions for yes/no questions (work authorization, sponsorship, availability) unless the resume states it
- If unsure, confidence < 0.75
- For dropdowns, return an exact member of options when options are provided
- For voluntary/EEO (gender, race, ethnicity, veteran, disability), value must be a decline-to-answer option
- Previously worked at Target: "No" is a safe default
- Skills: return a comma-separated subset that could match a skills taxonomy`
          }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }
    });

    if (typeof response === 'string') {
      const parsed = JSON.parse(response);
      const fieldResults = Array.isArray(parsed) ? parsed : (parsed.mappings || parsed.fields || []);

      for (const aiField of fieldResults) {
        const original = aiableFields.find(f => f.automationId === aiField.fieldId);
        if (!original) continue;
        if (aiField.confidence >= 0.75 && aiField.value !== undefined && aiField.value !== null && aiField.value !== '') {
          results.push({
            element: original.element,
            value: aiField.value,
            automationId: aiField.fieldId,
            label: original.label,
            widgetType: original.widgetType,
            method: 'ai',
            confidence: aiField.confidence,
            reasoning: aiField.reasoning
          });
        } else {
          results.push({
            element: original.element,
            value: null,
            automationId: original.automationId,
            label: original.label,
            widgetType: original.widgetType,
            method: 'ai_flagged',
            confidence: aiField.confidence || 0,
            reasoning: aiField.reasoning
          });
        }
      }

      for (const field of aiableFields) {
        if (!results.some(r => r.automationId === field.automationId)) {
          results.push({
            element: field.element,
            value: null,
            automationId: field.automationId,
            label: field.label,
            widgetType: field.widgetType,
            method: 'ai_flagged',
            confidence: 0,
            reasoning: 'No AI mapping returned'
          });
        }
      }
    }
  } catch (e) {
    console.error('AI mapping failed:', e);
    for (const field of aiableFields) {
      results.push({
        element: field.element,
        value: null,
        automationId: field.automationId,
        label: field.label,
        widgetType: field.widgetType,
        method: 'ai_error',
        confidence: 0,
        reasoning: e.message
      });
    }
  }

  return results;
}
