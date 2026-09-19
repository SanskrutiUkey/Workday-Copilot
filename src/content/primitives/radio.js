import { sleep } from '../../lib/utils.js';

function optionText(radio) {
  const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
  if (label) return label.textContent.trim();
  const parent = radio.parentElement;
  if (parent) return (parent.textContent || '').trim();
  return (radio.value || '').trim();
}

export async function fillRadio(container, value) {
  if (!container || value === undefined || value === null) return false;
  const strValue = String(value).toLowerCase().trim();

  const radios = container.querySelectorAll('input[type="radio"]');
  if (radios.length === 0) return false;

  for (const radio of radios) {
    const text = optionText(radio).toLowerCase();
    const val = (radio.value || '').toLowerCase();
    if (text === strValue || val === strValue || text.includes(strValue) || strValue.includes(text) || strValue.includes(val)) {
      radio.click();
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(50);
      return true;
    }
  }

  const wantYes = strValue === 'yes' || strValue === 'true' || strValue === '1';
  const wantNo = strValue === 'no' || strValue === 'false' || strValue === '0';

  if (wantYes || wantNo) {
    const match = Array.from(radios).find(r => {
      const txt = optionText(r).toLowerCase();
      return wantYes ? /\byes\b/.test(txt) : /\bno\b/.test(txt);
    });
    if (match) {
      match.click();
      match.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(50);
      return true;
    }
  }

  return false;
}
