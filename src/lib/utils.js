const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
).set;

function setInputValue(el, value) {
  nativeInputValueSetter.call(el, String(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function waitFor(predicate, timeout = 10000, interval = 100) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const result = predicate();
      if (result) return resolve(result);
      if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
      setTimeout(check, interval);
    };
    check();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function retry(fn, attempts = 2, delay = 500) {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === attempts) throw e;
      await sleep(delay);
    }
  }
}

function findBestMatch(target, options) {
  const normalized = target.toLowerCase().trim();
  if (!normalized || options.length === 0) return null;

  for (const opt of options) {
    if (opt.toLowerCase().trim() === normalized) return opt;
  }

  for (const opt of options) {
    const o = opt.toLowerCase().trim();
    if (o.startsWith(normalized) || normalized.startsWith(o)) return opt;
  }

  for (const opt of options) {
    const o = opt.toLowerCase().trim();
    const shorter = normalized.length < o.length ? normalized : o;
    const longer = normalized.length < o.length ? o : normalized;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.4) return opt;
  }

  let bestScore = 0;
  let bestMatch = null;
  for (const opt of options) {
    const o = opt.toLowerCase().trim();
    const shorter = normalized.length < o.length ? normalized : o;
    const longer = normalized.length < o.length ? o : normalized;
    if (shorter.length / longer.length < 0.3) continue;
    const score = similarity(normalized, o);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = opt;
    }
  }
  return bestScore > 0.7 ? bestMatch : null;
}

function similarity(a, b) {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

function editDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function dispatchSettleEvent() {
  window.dispatchEvent(new CustomEvent('workday-autofill-settle'));
}

export { setInputValue, waitFor, sleep, retry, findBestMatch, dispatchSettleEvent };
