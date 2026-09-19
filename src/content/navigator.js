import { STEP_IDS, STEP_ORDER, REPEATABLE_FIELD_MAP } from '../lib/constants.js';
import {
  WIDGET_TYPES,
  detectWidgetType,
  getFieldLabel,
  isFieldRequired,
  isVisible,
  getInteractiveControl,
  getNearbyQuestionText
} from './detector.js';
import { mapFields } from './mapper.js';
import { fillAllFields } from './filler.js';
import { waitForSettle, startObserving, stopObserving } from './observer.js';
import { waitFor, sleep } from '../lib/utils.js';
import { appendLog } from '../lib/store.js';
import { fillFile } from './primitives/file.js';
import { readDropdownOptions } from './primitives/dropdown.js';

let abortSignal = null;

export function setAbortSignal(signal) {
  abortSignal = signal;
}

function thrownIfAborted() {
  if (abortSignal?.aborted) throw new Error('Autofill stopped');
}

export function detectCurrentStep() {
  for (const stepId of STEP_ORDER) {
    if (document.querySelector(`[data-automation-id="${stepId}"]`)) {
      return stepId;
    }
  }

  const heading = (document.querySelector('h2, h1')?.textContent || '').toLowerCase();
  if (heading.includes('my information')) return STEP_IDS.MY_INFO;
  if (heading.includes('my experience')) return STEP_IDS.MY_EXP;
  if (heading.includes('application questions') || heading.includes('questions')) return STEP_IDS.QUESTIONS;
  if (heading.includes('voluntary')) return STEP_IDS.VOLUNTARY;
  if (heading.includes('review')) return STEP_IDS.REVIEW;

  if (document.querySelector('[data-automation-id="socialAuth"]') ||
      document.querySelector('[data-automation-id="loginForm"]') ||
      document.querySelector('[data-automation-id="authStep"]') ||
      document.querySelector('[data-automation-id="createAccount"]')) {
    return 'login';
  }

  return null;
}

function nextButtonLooksLikeSubmit() {
  const btn = getNextButton();
  if (!btn) return false;
  const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
  return /\bsubmit\b/.test(text);
}

function getNextButton() {
  return document.querySelector('[data-automation-id="pageFooterNextButton"]') ||
    document.querySelector('[data-automation-id="bottom-navigation-next-button"]') ||
    document.querySelector('[data-automation-id="next-button"]') ||
    document.querySelector('footer button:not([type="submit"])') ||
    document.querySelector('[class*="footer"] button:not([type="submit"])') ||
    [...document.querySelectorAll('button')].find(b => {
      const t = (b.textContent || '').toLowerCase().trim();
      return (t === 'next' || t === 'continue') && b.offsetParent !== null;
    });
}

export function isReviewStep() {
  if (detectCurrentStep() === STEP_IDS.REVIEW) return true;
  const heading = (document.querySelector('h2, h1')?.textContent || '').toLowerCase();
  if (heading.includes('review')) return true;
  return false;
}

function serializeField(f) {
  return {
    automationId: f.automationId,
    label: f.label,
    widgetType: f.widgetType,
    required: f.required,
    options: f.options,
    isRepeatable: !!f.isRepeatable,
    section: f.section || null
  };
}

const REPEATABLE_IDS = new Set(Object.keys(REPEATABLE_FIELD_MAP.experience).concat(Object.keys(REPEATABLE_FIELD_MAP.education)));

function classifyFieldSection(node) {
  let el = node.parentElement;
  for (let i = 0; i < 10 && el; i++) {
    const aid = (el.getAttribute?.('data-automation-id') || '').toLowerCase();
    if (aid.includes('workexperience') || aid.includes('workexperience')) return 'experience';
    if (aid.includes('education')) return 'education';
    const text = (el.innerText || el.textContent || '').slice(0, 400).toLowerCase();
    if (text.includes('work experience') || text.includes('job title')) return 'experience';
    if (text.includes('education') || text.includes('school or university') || text.includes('degree')) return 'education';
    el = el.parentElement;
  }
  return 'unknown';
}

export function discoverFields(root = document) {
  const fields = [];
  const seen = new Set();
  const nodes = root.querySelectorAll('[data-automation-id]');

  for (const node of nodes) {
    const automationId = node.getAttribute('data-automation-id');
    if (!automationId) continue;

    if (automationId === 'file-upload-input-ref' && !seen.has(automationId)) {
      seen.add(automationId);
      fields.push({
        automationId,
        element: node,
        container: node,
        label: 'Resume/CV',
        widgetType: WIDGET_TYPES.FILE,
        required: false,
        options: []
      });
      continue;
    }

    if (!automationId.startsWith('formField-') || automationId === 'formField-') continue;

    if (REPEATABLE_IDS.has(automationId)) {
      const section = classifyFieldSection(node);
      const sectionKey = `${automationId}__${section}`;
      if (seen.has(sectionKey)) continue;
      seen.add(sectionKey);
    } else {
      if (seen.has(automationId)) continue;
      seen.add(automationId);
    }

    const container = node.matches('[data-automation-id]') && node.getAttribute('data-automation-id') === automationId
      ? (node.querySelector ? node : node)
      : node;

    const group = root.querySelector(`[data-automation-id="${CSS.escape(automationId)}"]`) || container;
    const control = getInteractiveControl(group) || getInteractiveControl(node);
    if (!control) continue;

    let widgetType = detectWidgetType(group);
    if (widgetType === WIDGET_TYPES.TEXT) widgetType = detectWidgetType(control);

    const button = group.querySelector?.('button:not([type="submit"])');
    if (button && (control.tagName === 'INPUT' && !isVisible(control))) {
      widgetType = WIDGET_TYPES.DROPDOWN;
    }
    if (widgetType !== WIDGET_TYPES.DROPDOWN && group.querySelector?.('[data-automation-id="multiSelectContainer"], [data-uxi-widget-type="multiselect"]')) {
      widgetType = WIDGET_TYPES.MULTISELECT;
    }
    if (group.querySelectorAll?.('input[type="radio"]').length >= 2) widgetType = WIDGET_TYPES.RADIO;
    if (automationId.includes('CheckboxGroup') || group.querySelectorAll?.('input[type="checkbox"]').length > 1) {
      widgetType = WIDGET_TYPES.CHECKBOX;
    }
    if (/startDate|endDate|dateSection/i.test(automationId)) {
      widgetType = WIDGET_TYPES.DATE;
    }

    let label = getFieldLabel(control) || getFieldLabel(group);
    if (!label || label.length < 3) {
      label = getNearbyQuestionText(group) || label;
    }

    const required = isFieldRequired(control) || isFieldRequired(group);

    const fieldSection = REPEATABLE_IDS.has(automationId) ? classifyFieldSection(node) : null;

    fields.push({
      automationId,
      element: widgetType === WIDGET_TYPES.DROPDOWN ? (button || control) : control,
      container: group,
      label,
      widgetType,
      required,
      options: [],
      section: fieldSection
    });
  }

  const addButtons = root.querySelectorAll('[data-automation-id="add-button"]');
  for (const btn of addButtons) {
    if (!isVisible(btn)) continue;
    const section = classifyAddSection(btn);
    fields.push({
      automationId: 'add-button',
      element: btn,
      container: btn.closest('section, [data-automation-id]') || btn.parentElement,
      label: btn.textContent?.trim() || 'Add Another',
      widgetType: WIDGET_TYPES.BUTTON,
      required: false,
      options: [],
      isRepeatable: true,
      section
    });
  }

  return fields;
}

function classifyAddSection(btn) {
  let node = btn.parentElement;
  for (let i = 0; i < 8 && node; i++) {
    const text = (node.innerText || node.textContent || '').slice(0, 400).toLowerCase();
    if (text.includes('work experience') || text.includes('job title')) return 'experience';
    if (text.includes('education') || text.includes('school or university') || text.includes('degree')) return 'education';
    if (text.includes('language')) return 'language';
    node = node.parentElement;
  }
  const all = Array.from(document.querySelectorAll('[data-automation-id="add-button"]')).filter(isVisible);
  const idx = all.indexOf(btn);
  if (idx === 0) return 'experience';
  if (idx === 1) return 'education';
  if (idx === 2) return 'language';
  return 'unknown';
}

async function ensureInitialEntries(addButtons, resumeJson) {
  for (const addBtn of addButtons) {
    const section = addBtn.section || classifyAddSection(addBtn.element);
    const pathMap = REPEATABLE_FIELD_MAP[section];
    if (!pathMap) continue;

    const dataArray = section === 'experience'
      ? (resumeJson.experience || [])
      : section === 'education'
        ? (resumeJson.education || [])
        : [];

    if (dataArray.length === 0) continue;

    const firstFieldId = Object.keys(pathMap)[0];
    let existingFields = document.querySelectorAll(`[data-automation-id="${firstFieldId}"]`);

    if (existingFields.length === 0) {
      addBtn.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(200);
      addBtn.element.click();

      for (let i = 0; i < 15; i++) {
        await sleep(200);
        existingFields = document.querySelectorAll(`[data-automation-id="${firstFieldId}"]`);
        if (existingFields.length > 0) break;
      }

      await appendLog({ type: 'info', message: `Clicked ADD for empty ${section} section` });
    }
  }
}

function collectValidationErrors() {
  const errors = [];
  const nodes = document.querySelectorAll('[data-automation-id="errorHeading"], [aria-invalid="true"], [role="alert"]');
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || '').trim();
    if (text) errors.push(text);
  }
  return errors;
}

export async function clickNext() {
  const nextBtn = getNextButton();
  if (!nextBtn) {
    const allButtons = [...document.querySelectorAll('button')].map(b => `${b.getAttribute('data-automation-id') || 'no-id'}: "${(b.textContent || '').trim().slice(0, 30)}"`);
    throw new Error(`Next button not found. Buttons on page: ${allButtons.join(', ')}`);
  }
  nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(300);
  nextBtn.click();
  await sleep(600);
}

async function waitForStepChange(previousStep, timeout = 20000) {
  const start = Date.now();
  await sleep(800);
  let lastError = null;
  while (Date.now() - start < timeout) {
    thrownIfAborted();
    const currentStep = detectCurrentStep();
    if (currentStep && currentStep !== previousStep && currentStep !== 'login') {
      return currentStep;
    }

    const errors = collectValidationErrors();
    if (errors.length > 0 && !lastError) {
      lastError = errors.slice(0, 5).join('; ');
    }

    await sleep(400);
  }

  if (lastError) {
    throw new Error(`Validation errors: ${lastError}`);
  }
  throw new Error(`Step change timeout from "${previousStep}" after ${timeout}ms`);
}

function stripResults(results) {
  return (results || []).map(r => ({
    automationId: r.automationId,
    label: r.label,
    value: Array.isArray(r.value) ? r.value : r.value,
    widgetType: r.widgetType,
    method: r.method,
    confidence: r.confidence,
    success: r.success,
    reason: r.reason,
    reasoning: r.reasoning
  }));
}

export async function runAutofill(resumeJson, onProgress, options = {}) {
  const results = [];
  startObserving();
  abortSignal = options.signal || abortSignal;

  try {
    let stepCount = 0;
    const maxSteps = 8;

    while (stepCount < maxSteps) {
      thrownIfAborted();
      stepCount++;
      const currentStep = detectCurrentStep();
      await appendLog({ type: 'info', message: `detectCurrentStep() = ${JSON.stringify(currentStep)}` });

      if (!currentStep) {
        await appendLog({ type: 'info', message: 'No step detected, application may be complete' });
        break;
      }

      if (currentStep === 'login') {
        await appendLog({ type: 'info', message: 'Login detected - please sign in manually, then resume' });
        onProgress?.({ type: 'login_required' });
        await waitFor(() => detectCurrentStep() !== 'login', 300000, 1000);
        continue;
      }

      if (currentStep === STEP_IDS.REVIEW || isReviewStep()) {
        await appendLog({ type: 'info', message: 'Reached review step' });
        onProgress?.({ type: 'review_reached', results: stripResults(results) });
        break;
      }

      await appendLog({ type: 'step', message: `Processing step: ${currentStep}` });
      onProgress?.({ type: 'step_started', step: currentStep });

      await waitForSettle();

      const fields = discoverFields();
      let nonRepeatableFields = fields.filter(f => !f.isRepeatable);
      const addButtons = fields.filter(f => f.isRepeatable);

      if (currentStep === STEP_IDS.MY_EXP && addButtons.length > 0) {
        await ensureInitialEntries(addButtons, resumeJson);
        const refreshedFields = discoverFields();
        nonRepeatableFields = refreshedFields.filter(f => !f.isRepeatable);
      }

      await appendLog({ type: 'info', message: `Found ${nonRepeatableFields.length} fields on ${currentStep}` });

      if (options.resumeFile && currentStep === STEP_IDS.MY_EXP) {
        const fileInput = document.querySelector('[data-automation-id="file-upload-input-ref"], input[type="file"]');
        if (fileInput) {
          const ok = await fillFile(fileInput, options.resumeFile);
          results.push({
            automationId: 'file-upload-input-ref',
            label: 'Resume/CV',
            widgetType: WIDGET_TYPES.FILE,
            method: 'direct_upload',
            confidence: 1.0,
            success: ok,
            reason: ok ? 'uploaded' : 'upload_failed'
          });
          await appendLog({ type: 'info', message: ok ? 'Resume file uploaded' : 'Resume file upload failed' });
        }
      }

      if (currentStep === STEP_IDS.QUESTIONS || currentStep === STEP_IDS.VOLUNTARY) {
        for (const field of nonRepeatableFields) {
          if (field.widgetType === WIDGET_TYPES.DROPDOWN) {
            try {
              field.options = await readDropdownOptions(field.element);
            } catch {
              field.options = [];
            }
          }
        }
      }

      const fieldsForMapping = nonRepeatableFields.filter(f => f.automationId !== 'file-upload-input-ref');
      const mappings = await mapFields(fieldsForMapping, resumeJson);

      let fillResults;
      if (currentStep === STEP_IDS.QUESTIONS) {
        fillResults = mappings.map(m => ({
          ...m,
          success: false,
          method: 'user_review',
          reason: 'Questions require manual review'
        }));
      } else {
        const fillable = mappings.filter(m => m.automationId !== 'formField-acceptTermsAndAgreements' || resumeJson.meta?.acceptTerms === true);
        fillResults = await fillAllFields(fillable);
      }
      results.push(...fillResults);

      const successful = fillResults.filter(r => r.success).length;
      const failed = fillResults.filter(r => !r.success).length;
      await appendLog({ type: 'info', message: `Filled ${successful}, failed ${failed}` });

      onProgress?.({
        type: 'step_completed',
        step: currentStep,
        successful,
        failed,
        results: stripResults(fillResults)
      });

      if (currentStep === STEP_IDS.MY_EXP) {
        for (const addBtn of addButtons) {
          await handleRepeatableSection(addBtn, resumeJson);
        }
      }

      const shouldStopForReview =
        currentStep === STEP_IDS.QUESTIONS ||
        currentStep === STEP_IDS.VOLUNTARY ||
        nextButtonLooksLikeSubmit();

      const nextBtn = getNextButton();
      const btnText = nextBtn ? (nextBtn.textContent || '').trim() : 'N/A';
      const btnAutoId = nextBtn ? (nextBtn.getAttribute('data-automation-id') || 'none') : 'none';
      await appendLog({ type: 'info', message: `Next button: "${btnText}" (id=${btnAutoId}), shouldStop=${shouldStopForReview}` });

      if (shouldStopForReview) {
        await appendLog({ type: 'info', message: 'Stopping before submit — waiting for user confirmation' });
        onProgress?.({ type: 'review_reached', results: stripResults(results) });
        break;
      }

      try {
        await clickNext();
        const nextStep = await waitForStepChange(currentStep);
        await appendLog({ type: 'step', message: `Advanced to: ${nextStep}` });
      } catch (e) {
        await appendLog({ type: 'error', message: `Navigation failed: ${e.message}` });
        if (e.message.includes('Next button not found')) {
          onProgress?.({ type: 'error', message: e.message, results: stripResults(results) });
          break;
        }
        if (e.message.includes('Validation errors')) {
          onProgress?.({ type: 'error', message: e.message, results: stripResults(results) });
          break;
        }
        await appendLog({ type: 'info', message: 'Retrying navigation after delay...' });
        await sleep(2000);
        try {
          await clickNext();
          const nextStep = await waitForStepChange(currentStep, 20000);
          await appendLog({ type: 'step', message: `Advanced to: ${nextStep} (retry)` });
        } catch (e2) {
          await appendLog({ type: 'error', message: `Navigation retry failed: ${e2.message}` });
          onProgress?.({ type: 'error', message: e2.message, results: stripResults(results) });
          break;
        }
      }
    }
  } finally {
    stopObserving();
  }

  return stripResults(results);
}

async function handleRepeatableSection(addButton, resumeJson) {
  const section = addButton.section || classifyAddSection(addButton.element);
  const pathMap = REPEATABLE_FIELD_MAP[section];
  if (!pathMap) return;

  const dataArray = section === 'experience'
    ? (resumeJson.experience || [])
    : section === 'education'
      ? (resumeJson.education || [])
      : [];

  if (dataArray.length <= 1) return;

  for (let i = 1; i < dataArray.length; i++) {
    thrownIfAborted();
    const beforeCount = document.querySelectorAll(`[data-automation-id="${Object.keys(pathMap)[0]}"]`).length;
    addButton.element.click();
    await waitForSettle();
    await sleep(400);

    const entry = dataArray[i];
    const mappings = [];

    for (const [automationId, key] of Object.entries(pathMap)) {
      const nodes = Array.from(document.querySelectorAll(`[data-automation-id="${automationId}"]`));
      const node = nodes[nodes.length - 1];
      if (!node) continue;
      const control = getInteractiveControl(node) || node;
      const value = entry[key];
      if (value === undefined || value === null || value === '') continue;
      let wType = detectWidgetType(node);
      if (/startDate|endDate|dateSection/i.test(automationId)) wType = WIDGET_TYPES.DATE;
      mappings.push({
        element: control,
        value,
        automationId,
        label: key,
        widgetType: wType
      });
    }

    if (mappings.length) await fillAllFields(mappings);
    await appendLog({ type: 'info', message: `Added ${section} entry ${i + 1}` });
    if (document.querySelectorAll(`[data-automation-id="${Object.keys(pathMap)[0]}"]`).length <= beforeCount) {
      await appendLog({ type: 'info', message: `Add ${section} did not create a new panel` });
    }
  }
}

export async function clickSubmit() {
  const terms = document.querySelector('[data-automation-id="formField-acceptTermsAndAgreements"] input[type="checkbox"], [data-automation-id="formField-acceptTermsAndAgreements"]');
  if (terms) {
    const box = terms.matches('input[type="checkbox"]') ? terms : terms.querySelector('input[type="checkbox"]');
    if (box && !box.checked) {
      box.click();
      await sleep(200);
    }
  }

  const submitBtn =
    document.querySelector('[data-automation-id="bottom-navigation-submit-button"]') ||
    document.querySelector('[data-automation-id="pageFooterSubmitButton"]') ||
    document.querySelector('[data-automation-id*="submit"]') ||
    [...document.querySelectorAll('button, [role="button"]')].find(b => {
      const t = (b.textContent || b.getAttribute('aria-label') || '').toLowerCase().trim();
      return t.includes('submit') && b.offsetParent !== null;
    }) ||
    getNextButton();

  if (!submitBtn) throw new Error('Submit button not found');
  submitBtn.click();
  await sleep(800);
}

export { serializeField };
