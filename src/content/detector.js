const WIDGET_TYPES = {
  TEXT: 'text',
  DROPDOWN: 'dropdown',
  DATE: 'date',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  MULTISELECT: 'multiselect',
  FILE: 'file',
  BUTTON: 'button',
  UNKNOWN: 'unknown'
};

function isVisible(el) {
  if (!el) return false;
  if (el.getAttribute('type') === 'hidden') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return el.getClientRects().length > 0;
}

function getWidgetAttr(element) {
  const widgetEl = element.closest('[data-uxi-widget-type]');
  return widgetEl ? widgetEl.getAttribute('data-uxi-widget-type') : null;
}

function detectWidgetType(element) {
  if (!element) return WIDGET_TYPES.UNKNOWN;

  const widgetType = getWidgetAttr(element);
  const role = element.getAttribute('role');
  const type = (element.getAttribute('type') || '').toLowerCase();
  const tagName = element.tagName.toLowerCase();
  const automationId = getAutomationId(element) || '';

  if (type === 'file' || automationId === 'file-upload-input-ref') return WIDGET_TYPES.FILE;

  if (
    widgetType === 'multiselect' ||
    automationId === 'multiSelectContainer' ||
    automationId === 'formField-skills' ||
    automationId === 'formField-source' ||
    automationId === 'formField-countryPhoneCode' ||
    element.querySelector?.('[data-automation-id="multiSelectContainer"]') ||
    element.closest('[data-uxi-widget-type="multiselect"]')
  ) {
    return WIDGET_TYPES.MULTISELECT;
  }

  if (type === 'radio' || role === 'radio' || element.querySelector?.('input[type="radio"]')) {
    return WIDGET_TYPES.RADIO;
  }

  if (type === 'checkbox' || role === 'checkbox' || element.querySelector?.('input[type="checkbox"]')) {
    if (element.querySelectorAll?.('input[type="checkbox"]').length > 1) return WIDGET_TYPES.CHECKBOX;
    return WIDGET_TYPES.CHECKBOX;
  }

  if (tagName === 'textarea') return WIDGET_TYPES.TEXT;

  const hasButton = tagName === 'button' || !!element.querySelector?.('button[type="button"], button:not([type="submit"])');
  if (
    widgetType === 'selectinput' ||
    widgetType === 'selectinputlist' ||
    role === 'combobox' ||
    tagName === 'select' ||
    (hasButton && automationId.startsWith('formField-'))
  ) {
    return WIDGET_TYPES.DROPDOWN;
  }

  if (widgetType === 'date' || /startDate|endDate|dateSection/i.test(automationId) || element.querySelectorAll?.('[role="spinbutton"]').length >= 2) return WIDGET_TYPES.DATE;

  if (tagName === 'input' && type !== 'hidden') return WIDGET_TYPES.TEXT;

  if (hasButton && automationId.startsWith('formField-')) return WIDGET_TYPES.DROPDOWN;

  return WIDGET_TYPES.TEXT;
}

function getAutomationId(element) {
  if (!element) return null;
  if (element.getAttribute?.('data-automation-id')) {
    return element.getAttribute('data-automation-id');
  }
  const container = element.closest('[data-automation-id]');
  return container ? container.getAttribute('data-automation-id') : null;
}

function cleanLabel(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/\*$/, '')
    .replace(/\bRequired\b/gi, '')
    .trim();
}

function getFieldLabel(element) {
  if (!element) return '';

  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) {
      const t = cleanLabel(label.textContent);
      if (t) return t;
    }
  }

  const container = element.closest('[data-automation-id^="formField-"]') || element.closest('[data-automation-id]');
  if (container) {
    const labelEl = container.querySelector('label');
    if (labelEl) {
      const t = cleanLabel(labelEl.textContent);
      if (t) return t;
    }

    const labelled = container.getAttribute('aria-labelledby');
    if (labelled) {
      const t = cleanLabel(document.getElementById(labelled)?.textContent);
      if (t) return t;
    }
  }

  const ariaLabel = cleanLabel(element.getAttribute('aria-label'));
  if (ariaLabel) {
    const stripped = ariaLabel
      .replace(/\bSelect One\b/gi, '')
      .replace(/\bRequired\b/gi, '')
      .trim();
    if (stripped) return stripped;
  }

  const nearby = getNearbyQuestionText(element);
  if (nearby) return nearby;

  return ariaLabel || '';
}

function getNearbyQuestionText(element) {
  const container = element.closest('[data-automation-id^="formField-"]') || element.parentElement;
  if (!container) return '';

  let node = container.parentElement;
  for (let i = 0; i < 4 && node; i++) {
    const heading = node.querySelector('h1, h2, h3, h4, legend, [data-automation-id="formLabel"], p, div');
    const candidates = node.querySelectorAll('h1, h2, h3, h4, legend, label, p');
    for (const c of candidates) {
      if (container.contains(c)) continue;
      const text = cleanLabel(c.textContent);
      if (text.length > 12 && text.length < 400 && !/save and continue|progress/i.test(text)) {
        return text;
      }
    }
    if (heading && !container.contains(heading)) {
      const text = cleanLabel(heading.textContent);
      if (text.length > 8 && text.length < 400) return text;
    }
    node = node.parentElement;
  }

  const prev = container.previousElementSibling;
  if (prev) {
    const text = cleanLabel(prev.textContent);
    if (text.length > 8 && text.length < 400) return text;
  }

  return '';
}

function isFieldRequired(element) {
  if (!element) return false;
  if (element.getAttribute('aria-required') === 'true' || element.hasAttribute('required')) return true;

  const label = getFieldLabel(element);
  if (label.includes('*')) return true;

  const container = element.closest('[data-automation-id]');
  if (!container) return false;

  const aria = container.getAttribute('aria-label') || '';
  if (/\bRequired\b/i.test(aria)) return true;

  const labelEl = container.querySelector('label');
  if (labelEl && labelEl.textContent.includes('*')) return true;

  return false;
}

function getInteractiveControl(container) {
  if (!container) return null;

  const visibleButton = Array.from(container.querySelectorAll('button')).find(b => {
    const t = (b.getAttribute('type') || '').toLowerCase();
    if (t === 'submit') return false;
    return isVisible(b) || b.getAttribute('data-automation-id')?.startsWith('formField-');
  });

  if (container.matches('button') && isVisible(container)) return container;

  const radios = container.querySelectorAll('input[type="radio"]');
  if (radios.length) return radios[0];

  const checks = container.querySelectorAll('input[type="checkbox"]');
  if (checks.length) return checks[0];

  const multi = container.querySelector('[data-automation-id="multiSelectContainer"], [data-uxi-widget-type="multiselect"], [data-automation-id="multiselectInputContainer"]');
  if (multi) {
    return container.querySelector('input[type="text"], input:not([type])') || multi;
  }

  const textarea = container.querySelector('textarea');
  if (textarea && isVisible(textarea)) return textarea;

  const visibleInput = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])'))
    .find(el => isVisible(el));
  if (visibleInput) return visibleInput;

  if (visibleButton) return visibleButton;

  const file = container.querySelector('input[type="file"]');
  if (file) return file;

  const anyInput = container.querySelector('input:not([type="hidden"])');
  return anyInput || container;
}

function getCurrentFieldValue(element, widgetType) {
  if (!element) return '';
  const type = widgetType || detectWidgetType(element);

  if (type === WIDGET_TYPES.CHECKBOX) {
    const box = element.matches('input[type="checkbox"]') ? element : element.querySelector?.('input[type="checkbox"]');
    return box ? String(box.checked) : '';
  }

  if (type === WIDGET_TYPES.RADIO) {
    const checked = (element.closest('[data-automation-id]') || element).querySelector('input[type="radio"]:checked');
    if (!checked) return '';
    const label = checked.closest('label') || document.querySelector(`label[for="${checked.id}"]`);
    return (label ? label.textContent : checked.value || '').trim();
  }

  if (type === WIDGET_TYPES.MULTISELECT) {
    const container = element.closest('[data-automation-id^="formField-"]') || element.closest('[data-automation-id="multiSelectContainer"]')?.parentElement || element;
    const pills = container.querySelectorAll('[data-automation-id="selectedItem"]');
    return Array.from(pills).map(p => (p.getAttribute('aria-label') || p.textContent || '').replace(/,?\s*press delete.*$/i, '').trim()).filter(Boolean).join(', ');
  }

  if (type === WIDGET_TYPES.DROPDOWN) {
    const btn = element.tagName === 'BUTTON' ? element : (element.querySelector?.('button') || element);
    const aria = btn.getAttribute?.('aria-label') || '';
    const text = (btn.textContent || '').trim();
    const raw = aria || text;
    if (!raw) return '';
    if (/select one/i.test(raw)) return '';
    return cleanLabel(raw);
  }

  if (element.value !== undefined && element.value !== null && String(element.value).trim() !== '') {
    return String(element.value).trim();
  }

  return '';
}

function isPlaceholderValue(value, label) {
  if (!value) return true;
  const v = value.toLowerCase().trim();
  if (!v || v === 'select one' || v === 'select' || v === 'required') return true;
  const l = (label || '').toLowerCase();
  if (l && (v === l || v === `${l} required`)) return true;
  return false;
}

export {
  WIDGET_TYPES,
  detectWidgetType,
  getAutomationId,
  getFieldLabel,
  isFieldRequired,
  isVisible,
  getInteractiveControl,
  getCurrentFieldValue,
  isPlaceholderValue,
  getNearbyQuestionText,
  cleanLabel
};
