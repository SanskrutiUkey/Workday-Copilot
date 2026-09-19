import { sleep, dispatchSettleEvent } from '../lib/utils.js';

let observer = null;
let settleTimer = null;
let isSettled = true;
const SETTLE_DELAY = 600;

export function startObserving() {
  if (observer) return;

  isSettled = false;

  observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m =>
      m.type === 'childList' && m.addedNodes.length > 0 ||
      m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')
    );

    if (relevant) {
      isSettled = false;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        isSettled = true;
        dispatchSettleEvent();
      }, SETTLE_DELAY);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-automation-id']
  });

  settleTimer = setTimeout(() => {
    isSettled = true;
    dispatchSettleEvent();
  }, SETTLE_DELAY);
}

export function stopObserving() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

export function waitForSettle(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (isSettled) return resolve();

    const start = Date.now();
    const handler = () => {
      window.removeEventListener('workday-autofill-settle', handler);
      resolve();
    };

    window.addEventListener('workday-autofill-settle', handler);

    const checkInterval = setInterval(() => {
      if (isSettled || Date.now() - start > timeout) {
        clearInterval(checkInterval);
        window.removeEventListener('workday-autofill-settle', handler);
        resolve();
      }
    }, 200);
  });
}

export { isSettled };
