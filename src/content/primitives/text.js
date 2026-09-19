import { sleep } from '../../lib/utils.js';
import { triggerReactChange, forceReactUpdate, getReactFiberKey } from './reactHelper.js';

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

async function tryExecCommand(element, value) {
  element.focus();
  element.setSelectionRange(0, element.value.length);
  await sleep(30);

  document.execCommand('selectAll', false, null);
  await sleep(10);
  const ok = document.execCommand('insertText', false, value);
  await sleep(30);
  return ok && element.value === value;
}

async function tryKeyboardSequence(element, value) {
  element.focus();
  element.setSelectionRange(0, element.value.length);
  await sleep(30);

  const currentVal = element.value;
  for (let i = currentVal.length - 1; i >= 0; i--) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    nativeInputValueSetter.call(element, currentVal.slice(0, i));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
    await sleep(5);
  }

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
    nativeInputValueSetter.call(element, value.slice(0, i + 1));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
    await sleep(10);
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(30);
  return element.value === value;
}

export async function fillText(element, value) {
  if (!element || value === undefined || value === null) return false;
  const strValue = String(value).trim();
  if (!strValue) return false;

  console.log(`[Autofill/Text] Filling ${element.id || element.tagName} with "${strValue}"`);

  element.focus();
  await sleep(50);

  if (await tryExecCommand(element, strValue)) {
    const updated = forceReactUpdate(element);
    console.log(`[Autofill/Text] execCommand succeeded, forceReactUpdate=${updated}, domVal="${element.value}"`);
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(50);
    return true;
  }

  console.log(`[Autofill/Text] execCommand failed, trying keyboard sequence`);

  if (await tryKeyboardSequence(element, strValue)) {
    forceReactUpdate(element);
    console.log(`[Autofill/Text] keyboard sequence succeeded, domVal="${element.value}"`);
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(50);
    return true;
  }

  console.log(`[Autofill/Text] keyboard failed, trying triggerReactChange`);
  if (triggerReactChange(element, strValue)) {
    forceReactUpdate(element);
    console.log(`[Autofill/Text] triggerReactChange called, domVal="${element.value}"`);
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(50);
    return true;
  }

  nativeInputValueSetter.call(element, strValue);
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: strValue }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(50);

  console.log(`[Autofill/Text] All methods attempted, final domVal="${element.value}"`);
  return element.value === strValue;
}
