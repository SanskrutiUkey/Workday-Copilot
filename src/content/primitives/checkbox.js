import { sleep } from '../../lib/utils.js';

export async function fillCheckbox(element, value) {
  if (!element) return false;

  const isChecked = element.checked;
  const shouldCheck = typeof value === 'boolean' ? value :
    String(value).toLowerCase().trim() === 'true' ||
    String(value).toLowerCase().trim() === 'yes' ||
    String(value) === '1';

  if (isChecked !== shouldCheck) {
    element.click();
    await sleep(50);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return element.checked === shouldCheck;
}
