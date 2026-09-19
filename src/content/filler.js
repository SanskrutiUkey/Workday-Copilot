import {
  WIDGET_TYPES,
  detectWidgetType,
  getAutomationId,
  getFieldLabel,
  getCurrentFieldValue,
  isPlaceholderValue
} from './detector.js';
import { fillText } from './primitives/text.js';
import { fillDropdown } from './primitives/dropdown.js';
import { fillDate } from './primitives/date.js';
import { fillRadio } from './primitives/radio.js';
import { fillCheckbox } from './primitives/checkbox.js';
import { fillMultiselect } from './primitives/multiselect.js';
import { fillFile } from './primitives/file.js';
import { sleep } from '../lib/utils.js';

function coerceValue(value, widgetType) {
  if (value === undefined || value === null) return value;
  if (widgetType === WIDGET_TYPES.MULTISELECT) {
    if (Array.isArray(value)) return value;
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (widgetType === WIDGET_TYPES.CHECKBOX) return value;
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function fill(element, value, widgetType) {
  if (!element || value === undefined || value === null) return { success: false, reason: 'no_element' };

  const type = widgetType || detectWidgetType(element);
  const coerced = coerceValue(value, type);
  let success = false;

  const container = element.closest('[data-automation-id^="formField-"]') || element.parentElement || element;

  const aid = getAutomationId(element) || '';
  console.log(`[Autofill/Fill] fill() called: aid=${aid}, type=${type}, coerced=${JSON.stringify(coerced).slice(0, 200)}, element=${element.tagName}#${element.id}`);

  try {
    switch (type) {
      case WIDGET_TYPES.TEXT:
        success = await fillText(element, coerced);
        break;
      case WIDGET_TYPES.DROPDOWN:
        success = await fillDropdown(element, coerced);
        break;
      case WIDGET_TYPES.DATE:
        success = await fillDate(container, coerced);
        break;
      case WIDGET_TYPES.RADIO:
        success = await fillRadio(container, coerced);
        break;
      case WIDGET_TYPES.CHECKBOX:
        success = await fillCheckbox(
          element.matches?.('input[type="checkbox"]') ? element : container.querySelector('input[type="checkbox"]') || element,
          coerced
        );
        break;
      case WIDGET_TYPES.MULTISELECT:
        success = await fillMultiselect(container, coerced);
        break;
      case WIDGET_TYPES.FILE:
        success = await fillFile(element, coerced);
        break;
      default:
        success = await fillText(element, coerced);
    }
  } catch (e) {
    console.error(`[Autofill/Fill] fill() error for ${aid}:`, e);
    return { success: false, reason: e.message, widgetType: type };
  }

  await sleep(80);

  console.log(`[Autofill/Fill] fill() result: aid=${aid}, success=${success}, type=${type}`);

  return {
    success,
    widgetType: type,
    automationId: getAutomationId(element),
    label: getFieldLabel(element)
  };
}

export async function fillAllFields(fieldMappings) {
  const results = [];

  for (const mapping of fieldMappings) {
    const { element, value, widgetType, label, automationId } = mapping;

    if (!element) {
      results.push({ ...mapping, success: false, reason: 'element_not_found' });
      continue;
    }

    if (value === undefined || value === null || value === '') {
      results.push({ ...mapping, success: false, reason: 'no_value' });
      continue;
    }

    const currentValue = getCurrentFieldValue(element, widgetType);
    if (currentValue && !isPlaceholderValue(currentValue, label)) {
      const type = widgetType || detectWidgetType(element);
      if (type === WIDGET_TYPES.MULTISELECT) {
        const desired = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean);
        const current = currentValue.split(',').map(s => s.trim()).filter(Boolean);
        const allPresent = desired.every(d => current.some(c => c.toLowerCase() === d.toLowerCase() || c.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(c.toLowerCase())));
        if (allPresent) {
          results.push({ ...mapping, success: true, reason: 'already_filled', currentValue });
          continue;
        }
      } else {
        results.push({ ...mapping, success: true, reason: 'already_filled', currentValue });
        continue;
      }
    }

    let result = await fill(element, value, widgetType);
    if (automationId?.includes('skills')) {
      console.log(`[Autofill/Fill] skills field: fill() returned`, result);
    }
    if (!result.success) {
      await sleep(250);
      result = await fill(element, value, widgetType);
      if (automationId?.includes('skills')) {
        console.log(`[Autofill/Fill] skills field: retry fill() returned`, result);
      }
    }
    results.push({ ...mapping, ...result });
  }

  return results;
}
