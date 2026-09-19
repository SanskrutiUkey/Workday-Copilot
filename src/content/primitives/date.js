import { sleep } from '../../lib/utils.js';
import { forceReactUpdate } from './reactHelper.js';

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

function parseIso(isoDate) {
  if (!isoDate) return null;
  const raw = String(isoDate).trim();
  let month, day, year;
  if (raw.includes('-')) {
    const parts = raw.split('-');
    year = parts[0];
    month = parts[1];
    day = parts[2] || '01';
  } else if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts[2]) {
      month = parts[0];
      day = parts[1];
      year = parts[2];
    } else {
      month = parts[0];
      year = parts[1];
      day = '01';
    }
  } else {
    return null;
  }
  return { month, day, year };
}

function getSectionPrefix(container) {
  const sectionEl = container.closest('[data-automation-id*="workExperience"], [data-automation-id*="education"], [class*="experience"], [class*="education"]')
    || container.closest('[data-repeatable-index]')
    || container.parentElement?.parentElement;
  if (!sectionEl) return null;
  const autoId = sectionEl.getAttribute?.('data-automation-id') || '';
  const match = autoId.match(/^(workExperience-\d+|education-\d+)/);
  return match ? match[1] : null;
}

async function fillWithKeyboard(element, value) {
  element.focus();
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  await sleep(30);

  const currentVal = element.value;
  for (let i = currentVal.length - 1; i >= 0; i--) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true }));
    nativeInputValueSetter.call(element, currentVal.slice(0, i));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true }));
    await sleep(5);
  }

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = ch >= '0' && ch <= '9' ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
    const keyCode = ch.charCodeAt(0);
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code, keyCode, which: keyCode, bubbles: true }));
    nativeInputValueSetter.call(element, value.slice(0, i + 1));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ch, code, keyCode, which: keyCode, bubbles: true }));
    await sleep(10);
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(30);
  return element.value === value;
}

async function fillSingleInput(input, value) {
  const strVal = String(value);
  input.focus();
  input.select?.();
  await sleep(50);

  document.execCommand('selectAll', false, null);
  await sleep(10);
  document.execCommand('insertText', false, strVal);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  forceReactUpdate(input);
  await sleep(100);
  if (input.value === strVal) return true;

  console.log(`[Autofill/Date] execCommand failed for "${strVal}", trying keyboard sequence`);
  if (await fillWithKeyboard(input, strVal)) {
    console.log(`[Autofill/Date] keyboard sequence succeeded for "${strVal}"`);
    return true;
  }

  nativeInputValueSetter.call(input, strVal);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: strVal }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  forceReactUpdate(input);
  await sleep(100);

  return input.value === strVal;
}

function findDateInputs(container) {
  let monthInput = container.querySelector(
    '[data-automation-id*="dateSectionMonth-input"], [data-automation-id*="Month-input"], ' +
    'input[id*="dateSectionMonth-input"], input[id*="Month-input"]'
  );
  let yearInput = container.querySelector(
    '[data-automation-id*="dateSectionYear-input"], [data-automation-id*="Year-input"], ' +
    'input[id*="dateSectionYear-input"], input[id*="Year-input"]'
  );

  if (monthInput && yearInput) return { monthInput, yearInput };

  const prefix = getSectionPrefix(container);
  if (prefix) {
    const allMonth = document.querySelectorAll(`input[id*="${prefix}"][id*="dateSectionMonth-input"], input[id*="${prefix}"][id*="Month-input"]`);
    const allYear = document.querySelectorAll(`input[id*="${prefix}"][id*="dateSectionYear-input"], input[id*="${prefix}"][id*="Year-input"]`);
    if (allMonth.length > 0 && allYear.length > 0) {
      monthInput = allMonth[allMonth.length - 1];
      yearInput = allYear[allYear.length - 1];
      return { monthInput, yearInput };
    }
  }

  const parentContainer = container.parentElement?.parentElement?.parentElement;
  if (parentContainer) {
    monthInput = parentContainer.querySelector(
      '[data-automation-id*="dateSectionMonth-input"], input[id*="dateSectionMonth-input"]'
    );
    yearInput = parentContainer.querySelector(
      '[data-automation-id*="dateSectionYear-input"], input[id*="dateSectionYear-input"]'
    );
    if (monthInput && yearInput) return { monthInput, yearInput };
  }

  const grandParent = container.parentElement?.parentElement?.parentElement?.parentElement;
  if (grandParent) {
    monthInput = grandParent.querySelector(
      '[data-automation-id*="dateSectionMonth-input"], input[id*="dateSectionMonth-input"]'
    );
    yearInput = grandParent.querySelector(
      '[data-automation-id*="dateSectionYear-input"], input[id*="dateSectionYear-input"]'
    );
    if (monthInput && yearInput) return { monthInput, yearInput };
  }

  return { monthInput: null, yearInput: null };
}

export async function fillDate(container, isoDate) {
  if (!container || !isoDate) return false;
  const parsed = parseIso(isoDate);
  if (!parsed) return false;
  const { month, day, year } = parsed;

  console.log(`[Autofill/Date] fillDate: month=${month}, year=${year}, container=${container.getAttribute?.('data-automation-id') || container.tagName}`);

  const { monthInput, yearInput } = findDateInputs(container);

  if (monthInput && yearInput) {
    console.log(`[Autofill/Date] Found separate month/year inputs`);
    const mOk = await fillSingleInput(monthInput, parseInt(month, 10));
    console.log(`[Autofill/Date] Month: ${mOk ? 'OK' : 'FAILED'}, val="${monthInput.value}"`);

    monthInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
    monthInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
    await sleep(100);

    const yOk = await fillSingleInput(yearInput, parseInt(year, 10));
    console.log(`[Autofill/Date] Year: ${yOk ? 'OK' : 'FAILED'}, val="${yearInput.value}"`);

    const dateWidget = monthInput.closest('[data-uxi-widget-type="date"], [data-automation-id*="dateSection"]') || monthInput.parentElement?.parentElement;
    if (dateWidget) {
      dateWidget.dispatchEvent(new Event('change', { bubbles: true }));
      dateWidget.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log(`[Autofill/Date] Dispatched change/blur on date widget container`);
    }
    return mOk && yOk;
  }

  console.log(`[Autofill/Date] No month/year inputs found, trying spinbuttons`);

  const spinbuttons = container.querySelectorAll('[role="spinbutton"]');
  if (spinbuttons.length >= 3) {
    for (let i = 0; i < 3; i++) {
      const val = i === 0 ? parseInt(month, 10) : i === 1 ? parseInt(day, 10) : parseInt(year, 10);
      await fillSingleInput(spinbuttons[i], val);
      if (i < 2) {
        spinbuttons[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
        spinbuttons[i].dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
        await sleep(100);
      }
    }
    return true;
  }

  if (spinbuttons.length === 2) {
    for (let i = 0; i < 2; i++) {
      const val = i === 0 ? parseInt(month, 10) : parseInt(year, 10);
      await fillSingleInput(spinbuttons[i], val);
      if (i === 0) {
        spinbuttons[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
        spinbuttons[i].dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
        await sleep(100);
      }
    }
    return true;
  }

  console.log(`[Autofill/Date] No spinbuttons found, trying fallback input`);

  const formField = container.closest('[data-automation-id^="formField-"]') || container;
  const input = formField.matches('input')
    ? formField
    : formField.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');

  if (input) {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${mm}/${dd}/${year}`;
    return await fillSingleInput(input, dateStr);
  }

  const allInputs = container.querySelectorAll('input:not([type="hidden"])');
  for (const inp of allInputs) {
    if (inp.offsetParent !== null) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${mm}/${dd}/${year}`;
      return await fillSingleInput(inp, dateStr);
    }
  }

  console.log(`[Autofill/Date] No input found in container`);
  return false;
}
