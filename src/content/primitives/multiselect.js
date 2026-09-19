import { sleep, waitFor } from '../../lib/utils.js';

function log(msg, ...args) {
  console.log(`[Autofill/Multi] ${msg}`, ...args);
}

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

function getContainer(element) {
  return element.closest('[data-automation-id="multiSelectContainer"]') ||
    element.closest('[data-automation-id^="formField-"]') ||
    element.closest('[data-uxi-widget-type="multiselect"]')?.parentElement ||
    element;
}

function getSearchInput(container) {
  const mc = container.querySelector('[data-automation-id="multiSelectContainer"]') || container;
  return mc.querySelector('[data-automation-id="monikerSearchBox"] input') ||
    mc.querySelector('[data-automation-id="multiselectInputContainer"] input') ||
    mc.querySelector('input[placeholder*="Search"]') ||
    mc.querySelector('input[placeholder*="Type"]') ||
    mc.querySelector('input[placeholder*="Add"]') ||
    mc.querySelector('input[type="text"]') ||
    mc.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
}

function getPillCount(container) {
  const mc = container.querySelector('[data-automation-id="multiSelectContainer"]') || container;
  const pills = mc.querySelectorAll('[data-automation-id="selectedItem"]');
  return Array.from(pills).filter(el => el.getClientRects().length > 0).length;
}

async function setInputValueExecCommand(input, value) {
  input.focus();
  await sleep(50);
  input.setSelectionRange(0, input.value.length);
  document.execCommand('selectAll', false, null);
  await sleep(10);
  document.execCommand('insertText', false, value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(100);
}

function setInputValueFallback(input, value) {
  input.focus();
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearInput(input) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function pressEnter(input) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
}

function findDropdownItems() {
  const allOptions = document.querySelectorAll(
    '[role="option"], [data-automation-id="menuItem"], [data-automation-id*="menuItem"], [data-automation-id="promptOption"]'
  );
  return Array.from(allOptions).filter(el => {
    if (el.getClientRects().length === 0) return false;
    let current = el;
    for (let i = 0; i < 5 && current; i++) {
      const aid = current.getAttribute?.('data-automation-id');
      if (aid === 'selectedItemList' || aid === 'multiSelectContainer') return false;
      if (current.getAttribute?.('data-uxi-widget-type') === 'selectinputlist') return false;
      current = current.parentElement;
    }
    return true;
  });
}

function getItemText(el) {
  const label = el.querySelector('[data-automation-id="promptOption"]');
  if (label) return (label.textContent || '').trim();
  return (el.textContent || '').trim();
}

async function waitForFreshDropdown(timeout = 4000) {
  const start = Date.now();
  let prevCount = -1;
  let stableItems = [];
  while (Date.now() - start < timeout) {
    const items = findDropdownItems();
    if (items.length === 0) {
      prevCount = 0;
      stableItems = [];
      await sleep(100);
      continue;
    }
    if (items.length !== prevCount) {
      prevCount = items.length;
      stableItems = items;
      await sleep(300);
      continue;
    }
    const currentTexts = stableItems.map(getItemText).join('|');
    await sleep(300);
    const newItems = findDropdownItems();
    const newTexts = newItems.map(getItemText).join('|');
    if (currentTexts === newTexts && newItems.length > 0) return newItems;
    stableItems = newItems;
    prevCount = newItems.length;
  }
  return findDropdownItems();
}

async function askAI(prompt) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'AI_REQUEST',
      payload: {
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

async function collectDropdownOptions(input, searchValue) {
  await setInputValueExecCommand(input, searchValue);
  await sleep(200);

  pressEnter(input);
  await sleep(300);
  const options = await waitForFreshDropdown(4000);
  const texts = options.map(getItemText).filter(Boolean);
  clearInput(input);
  await sleep(100);
  return texts;
}

export async function fillMultiselect(containerOrEl, values) {
  if (!containerOrEl || values === undefined || values === null) return false;
  const items = Array.isArray(values)
    ? values
    : String(values).split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return false;

  const container = getContainer(containerOrEl);
  const containerId = container?.getAttribute?.('data-automation-id') || 'unknown';
  const pillsBefore = getPillCount(container);
  log(`Starting fill: ${items.length} items, container="${containerId}", pillsBefore=${pillsBefore}`);

  const input = getSearchInput(container);
  if (!input) {
    log(`ERROR: No search input found in container "${containerId}"`);
    return false;
  }

  log(`Input: id="${input.id}", placeholder="${input.placeholder}"`);

  log(`Phase 1: Collecting dropdown options for ${items.length} items`);
  const skillOptionsMap = {};

  for (const item of items.slice(0, 25)) {
    const strValue = String(item).trim();
    if (!strValue) continue;

    log(`  Searching "${strValue}"`);
    const options = await collectDropdownOptions(input, strValue);
    skillOptionsMap[strValue] = options;
    log(`  "${strValue}" → ${options.length} options: ${options.slice(0, 5).join(', ')}${options.length > 5 ? '...' : ''}`);
  }

  if (Object.values(skillOptionsMap).every(opts => opts.length === 0)) {
    log(`Phase 1b: All searches returned 0 options, trying empty search to get all options`);
    const allOptions = await collectDropdownOptions(input, '');
    log(`  Empty search → ${allOptions.length} options: ${allOptions.slice(0, 10).join(', ')}`);

    if (allOptions.length > 0) {
      for (const item of items.slice(0, 25)) {
        const strValue = String(item).trim();
        if (strValue && skillOptionsMap[strValue].length === 0) {
          skillOptionsMap[strValue] = allOptions;
        }
      }
    }
  }

  log(`Phase 2: Asking AI to map skills to dropdown options`);
  const skillList = Object.keys(skillOptionsMap);
  const allUniqueOptions = [...new Set(Object.values(skillOptionsMap).flat())];
  const prompt = `You are a field matching assistant. Match user values to Workday dropdown options.

USER VALUES: ${JSON.stringify(skillList)}

ALL AVAILABLE WORKDAY OPTIONS (30 total): ${JSON.stringify(allUniqueOptions)}

CRITICAL RULES:
- You MUST return a match for EVERY user value — NEVER return null
- ALWAYS pick the CLOSEST available option, even if it's not a perfect match
- "Computer Science and Engineering" → look for "Computer & Information Sciences" or "Computer Engineering" or "Computer Science"
- "Computer Science" → "Computer & Information Sciences" or "Computer Engineering"
- Semantic matching is required: field of study values must map to the closest academic discipline
- If no close match exists, pick the option that shares the most keywords
- Return ONLY the JSON object, no other text

Return format: {"Computer Science and Engineering": "Computer & Information Sciences", ...}`;

  let mapping;
  try {
    const aiResponse = await askAI(prompt);
    log(`AI response received: ${aiResponse.substring(0, 200)}...`);
    mapping = JSON.parse(aiResponse);
    log(`Parsed mapping:`, mapping);
  } catch (err) {
    log(`AI call failed: ${err.message}, falling back to first-option matching`);
    mapping = {};
    for (const [skill, options] of Object.entries(skillOptionsMap)) {
      mapping[skill] = options.length > 0 ? options[0] : null;
    }
  }

  log(`Phase 3: Clicking matched checkboxes`);
  let added = 0;

  for (const item of items.slice(0, 25)) {
    const strValue = String(item).trim();
    if (!strValue) continue;

    const targetText = mapping[strValue];
    if (!targetText) {
      log(`  Skipping "${strValue}" — no match`);
      continue;
    }

    log(`  Searching "${strValue}" to find "${targetText}"`);
    await setInputValueExecCommand(input, strValue);
    await sleep(200);

    pressEnter(input);
    await sleep(300);
    const options = await waitForFreshDropdown(4000);
    log(`  Dropdown: ${options.length} options found`);

    if (options.length) {
      const targetOption = options.find(o => getItemText(o) === targetText);

      if (targetOption) {
        log(`  Clicking "${targetText}"`);
        const checkbox = targetOption.querySelector('input[type="checkbox"], [role="checkbox"], [data-automation-id*="check"]');
        if (checkbox) {
          checkbox.click();
        } else {
          targetOption.click();
        }
        await sleep(400);
        const newPills = getPillCount(container);
        log(`  Pills: ${newPills} (was ${pillsBefore + added})`);
        added++;
      } else {
        log(`  "${targetText}" not found in dropdown, trying contains match`);
        const fuzzy = options.find(o => {
          const t = getItemText(o);
          return t.toLowerCase().includes(targetText.toLowerCase()) || targetText.toLowerCase().includes(t.toLowerCase());
        });
        if (fuzzy) {
          log(`  Fuzzy click: "${getItemText(fuzzy)}"`);
          const checkbox = fuzzy.querySelector('input[type="checkbox"], [role="checkbox"], [data-automation-id*="check"]');
          if (checkbox) checkbox.click();
          else fuzzy.click();
          await sleep(400);
          added++;
        }
      }
    }

    clearInput(input);
    await sleep(100);
  }

  const pillsAfter = getPillCount(container);
  log(`Done: pillsBefore=${pillsBefore}, pillsAfter=${pillsAfter}, added=${added}, result=${pillsAfter > pillsBefore}`);
  return pillsAfter > pillsBefore;
}
