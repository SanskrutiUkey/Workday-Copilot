import { waitFor, sleep, findBestMatch } from '../../lib/utils.js';
import { triggerReactChange, getReactFiberKey } from './reactHelper.js';

function log(msg) {
  console.log(`[Autofill/Dropdown] ${msg}`);
}

const DEGREE_LEVEL_MAP = {
  'b.tech': 'Bachelors level degree', 'btech': 'Bachelors level degree',
  'b.e.': 'Bachelors level degree', 'be': 'Bachelors level degree',
  'bachelor': 'Bachelors level degree', 'bachelors': 'Bachelors level degree',
  'b.sc': 'Bachelors level degree', 'bsc': 'Bachelors level degree',
  'b.s.': 'Bachelors level degree', 'bs': 'Bachelors level degree',
  'b.ca': 'Bachelors level degree', 'bca': 'Bachelors level degree',
  'm.tech': 'Masters level degree', 'mtech': 'Masters level degree',
  'm.e.': 'Masters level degree', 'me': 'Masters level degree',
  'master': 'Masters level degree', 'masters': 'Masters level degree',
  'm.sc': 'Masters level degree', 'msc': 'Masters level degree',
  'm.s.': 'Masters level degree', 'ms': 'Masters level degree',
  'm.ca': 'Masters level degree', 'mca': 'Masters level degree',
  'mba': 'Masters level degree', 'm.b.a.': 'Masters level degree',
  'phd': 'Doctorate level degree', 'ph.d': 'Doctorate level degree',
  'ph.d.': 'Doctorate level degree', 'doctorate': 'Doctorate level degree',
  'doctoral': 'Doctorate level degree',
};

function matchDegreeValue(value, options) {
  const normalized = String(value).toLowerCase().trim().replace(/[^a-z0-9.]/g, '');
  const mapped = DEGREE_LEVEL_MAP[normalized];
  if (mapped) {
    const found = options.find(o => o.toLowerCase().trim() === mapped.toLowerCase());
    if (found) {
      log(`Degree mapping: "${value}" → "${found}"`);
      return found;
    }
  }
  for (const [key, level] of Object.entries(DEGREE_LEVEL_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const found = options.find(o => o.toLowerCase().trim() === level.toLowerCase());
      if (found) {
        log(`Degree fuzzy mapping: "${value}" → "${found}" via "${key}"`);
        return found;
      }
    }
  }
  return null;
}

function isAncestorOf(parent, child) {
  if (!parent || !child) return false;
  let node = child;
  while (node) {
    if (node === parent) return true;
    node = node.parentElement;
  }
  return false;
}

function findOpenListNearTrigger(trigger) {
  const allListboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
  const visible = allListboxes.filter(el => el.getClientRects().length > 0);
  if (visible.length === 0) return null;
  if (visible.length === 1) return visible[0];

  const triggerContainer = trigger?.closest('[data-automation-id^="formField-"]') || trigger?.parentElement;

  for (const lb of visible) {
    let node = lb;
    for (let i = 0; i < 12 && node; i++) {
      if (node === triggerContainer || node === trigger) return lb;
      const aid = node.getAttribute?.('data-automation-id') || '';
      if (triggerContainer && aid === triggerContainer.getAttribute('data-automation-id')) return lb;
      node = node.parentElement;
    }
  }

  for (const lb of visible) {
    if (isAncestorOf(lb, trigger) || isAncestorOf(trigger, lb)) return lb;
  }

  for (const lb of visible) {
    let parent = lb.parentElement;
    for (let i = 0; i < 8 && parent; i++) {
      if (parent.contains(trigger)) return lb;
      parent = parent.parentElement;
    }
  }

  return visible[visible.length - 1];
}

function findOpenList() {
  const candidates = [
    ...document.querySelectorAll('[role="listbox"]'),
    ...document.querySelectorAll('[data-automation-id="selectinputlist"], [data-uxi-widget-type="selectinputlist"]'),
    ...document.querySelectorAll('[data-automation-id="promptOption"], [data-automation-id="menuItem"]')
  ];
  for (const el of candidates) {
    if (el.getClientRects().length > 0) {
      if (el.getAttribute('role') === 'option' || el.getAttribute('data-automation-id') === 'menuItem') {
        return el.parentElement;
      }
      return el;
    }
  }
  return null;
}

function getOptions(list) {
  if (!list) return [];
  const opts = list.querySelectorAll('[role="option"], [data-automation-id="promptOption"], [data-automation-id="menuItem"], li');
  return Array.from(opts).filter(o => o.getClientRects().length > 0);
}

function findTrigger(element) {
  if (!element) return null;
  if (element.tagName === 'BUTTON') return element;
  const container = element.closest('[data-automation-id^="formField-"]') || element.parentElement;
  const btn = container?.querySelector('button:not([type="submit"])');
  if (btn) return btn;
  return element;
}

function findSearchInput(list) {
  if (!list) return document.querySelector('[role="listbox"] input, [data-automation-id="searchBox"] input, input[placeholder="Search"]');
  return list.querySelector('input[type="text"], input:not([type])') ||
    list.parentElement?.querySelector('input[type="text"], input[placeholder="Search"]');
}

function triggerReactOptionClick(option) {
  option.click();

  const fiberKey = getReactFiberKey(option);
  if (fiberKey) {
    let fiber = option[fiberKey];
    for (let i = 0; i < 30 && fiber; i++) {
      try {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props?.onClick) {
          props.onClick({ target: option, currentTarget: option, preventDefault() {}, stopPropagation() {} });
          return;
        }
      } catch (e) {}
      fiber = fiber.return;
    }
  }

  const propsKey = Object.keys(option).find(k => k.startsWith('__reactProps$'));
  if (propsKey && option[propsKey]?.onClick) {
    try {
      option[propsKey].onClick({ target: option, currentTarget: option, preventDefault() {}, stopPropagation() {} });
    } catch (e) {}
  }
}

export async function fillDropdown(triggerElement, value) {
  if (!triggerElement || value === undefined || value === null) return false;
  const strValue = String(value).trim();
  if (!strValue) return false;

  log(`Filling dropdown: "${strValue}", element=${triggerElement.tagName}#${triggerElement.id}`);

  const trigger = findTrigger(triggerElement);
  if (!trigger) {
    log(`No trigger found for element`);
    return false;
  }

  log(`Trigger: ${trigger.tagName}#${trigger.id}, clicking...`);
  trigger.click();
  await sleep(500);

  let list = null;
  try {
    list = await waitFor(() => findOpenListNearTrigger(trigger), 5000, 80);
  } catch {
    list = findOpenListNearTrigger(trigger);
  }

  if (!list) {
    log(`No list found after first click, retrying...`);
    trigger.click();
    await sleep(500);
    try {
      list = await waitFor(() => findOpenListNearTrigger(trigger), 5000, 80);
    } catch {
      list = findOpenListNearTrigger(trigger);
    }
  }

  if (!list) {
    log(`Still no list found. Checking all listboxes...`);
    const allListboxes = document.querySelectorAll('[role="listbox"]');
    log(`Total [role=listbox] in DOM: ${allListboxes.length}`);
    for (const lb of allListboxes) {
      const opts = getOptions(lb);
      log(`  listbox: visible=${lb.getClientRects().length > 0}, opts=${opts.length}, id=${lb.id}, parent=${lb.parentElement?.getAttribute('data-automation-id') || lb.parentElement?.tagName}`);
    }
    return false;
  }

  log(`List found: ${list.tagName}#${list.id}, role=${list.getAttribute('role')}`);

  const search = findSearchInput(list);
  if (search) {
    log(`Search input found: ${search.id || search.placeholder}`);
    search.focus();
    if (!triggerReactChange(search, strValue)) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(search, strValue);
      else search.value = strValue;
    }
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    search.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(500);
  } else {
    log(`No search input found in list`);
  }

  let options = getOptions(list);
  if (options.length === 0) {
    await sleep(300);
    options = getOptions(findOpenListNearTrigger(trigger) || list);
  }

  log(`Options found: ${options.length}`);
  for (const opt of options.slice(0, 15)) {
    log(`  option: "${(opt.textContent || '').trim()}"`);
  }

  if (options.length === 0) {
    document.body.click();
    return false;
  }

  const optionTexts = options.map(o => (o.textContent || '').trim()).filter(Boolean);

  const degreeMatch = matchDegreeValue(strValue, optionTexts);
  if (degreeMatch) {
    for (const opt of options) {
      if ((opt.textContent || '').trim() === degreeMatch) {
        log(`Degree level match: "${degreeMatch}"`);
        triggerReactOptionClick(opt);
        await sleep(300);
        return true;
      }
    }
  }

  let match = strValue === 'FIRST_OPTION' || strValue === '__FIRST__' ? optionTexts[0] : findBestMatch(strValue, optionTexts);

  log(`Best match for "${strValue}": ${match || 'NONE'}`);

  if (!match) {
    for (const opt of options) {
      const text = (opt.textContent || '').trim();
      if (text.toLowerCase().includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text.toLowerCase())) {
        log(`Fallback contains match: "${text}"`);
        triggerReactOptionClick(opt);
        await sleep(300);
        return true;
      }
    }
    log(`No match at all, falling back to first option: "${optionTexts[0]}"`);
    match = optionTexts[0];
  }

  for (const opt of options) {
    if ((opt.textContent || '').trim() === match) {
      log(`Clicking matched option: "${match}"`);
      triggerReactOptionClick(opt);
      await sleep(300);
      return true;
    }
  }

  document.body.click();
  return false;
}

export async function readDropdownOptions(triggerElement) {
  const trigger = findTrigger(triggerElement);
  if (!trigger) return [];
  trigger.click();
  await sleep(250);
  let list = findOpenList();
  try {
    list = await waitFor(() => findOpenList(), 3000, 80);
  } catch {
    list = findOpenList();
  }
  const options = getOptions(list).map(o => (o.textContent || '').trim()).filter(Boolean);
  document.body.click();
  await sleep(150);
  return options;
}
