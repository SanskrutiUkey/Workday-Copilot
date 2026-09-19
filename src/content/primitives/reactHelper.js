const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

export function getReactPropsKey(element) {
  return Object.keys(element).find(k => k.startsWith('__reactProps$'));
}

export function getReactFiberKey(element) {
  return Object.keys(element).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
}

function findAllKeys(element) {
  return Object.keys(element).filter(k =>
    k.startsWith('__react') || k.startsWith('_react') ||
    k.startsWith('__vue') || k.startsWith('__svelte') ||
    k.startsWith('__webcomponent') || k.startsWith('__shadow') ||
    k.startsWith('__') && k.endsWith('$')
  );
}

function findFrameworkGlobals() {
  const globals = {};
  const checks = ['Workday', 'WD', 'workday', 'UDS', 'uds', 'UXI', 'uxi', 'Blue', 'blue',
    'React', 'ReactDOM', '__NEXT_DATA__', 'angular', '__zone_symbol__',
    '_frameElement', 'ember', 'Ember'];
  for (const name of checks) {
    try {
      if (window[name]) globals[name] = typeof window[name];
    } catch (e) {}
  }
  for (const key of Object.keys(window)) {
    if (key.startsWith('__') && (key.includes('workday') || key.includes('Workday') || key.includes('UDS') || key.includes('uxi'))) {
      globals[key] = typeof window[key];
    }
  }
  return globals;
}

let _frameworkLogged = false;
export function logFrameworkInfo() {
  if (_frameworkLogged) return;
  _frameworkLogged = true;

  const input = document.querySelector('input[data-automation-id]');
  if (!input) return;

  const allKeys = findAllKeys(input);
  const parentKeys = input.parentElement ? findAllKeys(input.parentElement) : [];
  const grandparentKeys = input.parentElement?.parentElement ? findAllKeys(input.parentElement.parentElement) : [];
  const globals = findFrameworkGlobals();

  console.log(`[ReactHelper] Input keys: ${allKeys.length ? allKeys.join(', ') : 'NONE'}`);
  console.log(`[ReactHelper] Parent keys: ${parentKeys.length ? parentKeys.join(', ') : 'NONE'}`);
  console.log(`[ReactHelper] Grandparent keys: ${grandparentKeys.length ? grandparentKeys.join(', ') : 'NONE'}`);
  console.log(`[ReactHelper] Framework globals:`, globals);

  const desc = Object.getOwnPropertyDescriptor(input, 'value');
  console.log(`[ReactHelper] Input 'value' descriptor: configurable=${desc?.configurable}, writable=${desc?.writable}, hasSet=${!!desc?.set}`);
}

export function triggerReactChange(input, value) {
  if (!input) return false;

  nativeInputValueSetter.call(input, value);

  const propsKey = getReactPropsKey(input);
  if (propsKey && input[propsKey]) {
    const handler = input[propsKey].onChange || input[propsKey].onInput;
    if (handler) {
      try {
        handler.call(input, { target: input, currentTarget: input, type: 'change', bubbles: true });
        console.log(`[ReactHelper] Called onChange on __reactProps$ for ${input.tagName}#${input.id}`);
        return true;
      } catch (e) {
        console.log(`[ReactHelper] __reactProps$ handler threw:`, e);
      }
    }
  }

  const fiberKey = getReactFiberKey(input);
  if (fiberKey) {
    let fiber = input[fiberKey];
    for (let i = 0; i < 40 && fiber; i++) {
      try {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props) {
          const handler = props.onChange || props.onInput;
          if (handler) {
            handler.call(input, { target: input, currentTarget: input, type: 'change', bubbles: true });
            console.log(`[ReactHelper] Called onChange on fiber level ${i} for ${input.tagName}#${input.id}`);
            return true;
          }
        }
      } catch (e) {}
      fiber = fiber.return;
    }
  }

  let parent = input.parentElement;
  for (let i = 0; i < 8 && parent; i++) {
    const pKey = getReactPropsKey(parent);
    if (pKey && parent[pKey]) {
      const handler = parent[pKey].onChange || parent[pKey].onInput;
      if (handler) {
        try {
          handler.call(parent, { target: input, currentTarget: parent, type: 'change', bubbles: true });
          console.log(`[ReactHelper] Called parent onChange via __reactProps$ level ${i}`);
          return true;
        } catch (e) {}
      }
    }
    const fKey = getReactFiberKey(parent);
    if (fKey) {
      let fiber = parent[fKey];
      for (let j = 0; j < 15 && fiber; j++) {
        try {
          const props = fiber.memoizedProps || fiber.pendingProps;
          if (props) {
            const handler = props.onChange || props.onInput;
            if (handler) {
              handler.call(parent, { target: input, currentTarget: parent, type: 'change', bubbles: true });
              console.log(`[ReactHelper] Called parent onChange via fiber level ${j}`);
              return true;
            }
          }
        } catch (e) {}
        fiber = fiber.return;
      }
    }
    parent = parent.parentElement;
  }

  console.log(`[ReactHelper] No React handler found for ${input.tagName}#${input.id}`);
  return false;
}

export function forceReactUpdate(input) {
  const fiberKey = getReactFiberKey(input);
  if (!fiberKey) {
    return tryUxiUpdate(input);
  }

  let fiber = input[fiberKey];
  let updated = false;

  for (let i = 0; i < 40 && fiber; i++) {
    try {
      if (fiber.stateNode && fiber.stateNode !== input && typeof fiber.stateNode.forceUpdate === 'function') {
        fiber.stateNode.forceUpdate();
        updated = true;
        console.log(`[ReactHelper] forceUpdate on class component at fiber level ${i}`);
        break;
      }
    } catch (e) {}
    fiber = fiber.return;
  }

  if (!updated) {
    fiber = input[fiberKey];
    for (let i = 0; i < 40 && fiber; i++) {
      try {
        if (fiber.memoizedState) {
          let hook = fiber.memoizedState;
          let hookIndex = 0;
          while (hook) {
            if (hook.memoizedState !== undefined && hook.memoizedState !== null) {
              const currentVal = typeof hook.memoizedState === 'object' && hook.memoizedState !== null
                ? (hook.memoizedState.queue ? hook.memoizedState.queue.lastRenderedState : hook.memoizedState)
                : hook.memoizedState;
              if (typeof currentVal === 'string' && currentVal !== input.value && currentVal.length < 200) {
                console.log(`[ReactHelper] Found value hook at level ${i}, hook ${hookIndex}`);
                if (hook.queue && typeof hook.queue.dispatch === 'function') {
                  hook.queue.dispatch(input.value);
                  updated = true;
                  break;
                }
              }
            }
            hook = hook.next;
            hookIndex++;
          }
          if (updated) break;
        }
      } catch (e) {}
      fiber = fiber.return;
    }
  }

  if (!updated) {
    return tryUxiUpdate(input);
  }

  return updated;
}

function tryUxiUpdate(input) {
  console.log(`[ReactHelper] Trying UXI/framework update for ${input.id || input.tagName}`);

  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  console.log(`[ReactHelper] Dispatched focus/focusin/blur/focusout/change cycle`);

  const container = input.closest('[data-automation-id^="formField-"]');
  if (container) {
    container.dispatchEvent(new Event('change', { bubbles: true }));
    container.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log(`[ReactHelper] Dispatched change/blur on container ${container.getAttribute('data-automation-id')}`);
  }

  let ancestor = input.parentElement;
  for (let i = 0; i < 10 && ancestor; i++) {
    const keys = Object.keys(ancestor);
    const uxKeys = keys.filter(k => k.startsWith('__') && k.endsWith('$'));
    if (uxKeys.length > 0) {
      console.log(`[ReactHelper] Found custom keys on ancestor level ${i}: ${uxKeys.join(', ')}`);
      for (const key of uxKeys) {
        try {
          const val = ancestor[key];
          if (val && typeof val === 'object') {
            const props = val.memoizedProps || val.pendingProps || val.props;
            if (props?.onChange) {
              props.onChange({ target: input, currentTarget: ancestor, type: 'change', bubbles: true });
              console.log(`[ReactHelper] Called ancestor onChange via ${key}`);
              return true;
            }
          }
        } catch (e) {}
      }
    }
    ancestor = ancestor.parentElement;
  }

  return false;
}
