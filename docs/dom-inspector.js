/**
 * Workday DOM Reconnaissance Inspector
 *
 * Paste this entire script into DevTools console on any Workday job application page.
 * It walks the DOM, collects metadata about every interactive element, classifies
 * widget types, and outputs structured JSON. Read-only — no clicks, no fills, no submission.
 *
 * Output: JSON copied to clipboard + logged to console.
 * Paste into docs/dom-notes.json.
 */
(() => {
  'use strict';

  const MAX_NEARBY_TEXT = 120;
  const VISIBILITY_CHECK = { rootMargin: '0px', threshold: 0 };

  function collectElementData(el) {
    const data = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      name: el.name || null,
      type: el.type || null,
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      ariaLabelledBy: null,
      labelText: null,
      placeholder: el.placeholder || null,
      required: el.required || el.getAttribute('aria-required') === 'true' || el.hasAttribute('required'),
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      automationId: null,
      widgetType: null,
      parentDataAttributes: {},
      isVisible: isElementVisible(el),
      nearbyText: null,
      classifiedAs: null
    };

    // --- Resolve automationId (element or nearest ancestor) ---
    const autoEl = el.closest('[data-automation-id]');
    if (autoEl) {
      data.automationId = autoEl.getAttribute('data-automation-id');
      // Collect all data-* attributes from the automation container
      for (const attr of autoEl.attributes) {
        if (attr.name.startsWith('data-') && attr.name !== 'data-automation-id') {
          data.parentDataAttributes[attr.name] = attr.value;
        }
      }
    }

    // --- Resolve widgetType from data-uxi-widget-type (element or ancestor) ---
    const widgetEl = el.closest('[data-uxi-widget-type]');
    if (widgetEl) {
      data.widgetType = widgetEl.getAttribute('data-uxi-widget-type');
    }

    // --- Resolve aria-labelledby ---
    const labelledById = el.getAttribute('aria-labelledby');
    if (labelledById) {
      const labelEl = document.getElementById(labelledById);
      if (labelEl) {
        data.ariaLabelledBy = labelEl.textContent.trim();
      }
    }

    // --- Resolve label text (priority order) ---
    data.labelText = resolveLabel(el);

    // --- Resolve nearby descriptive text ---
    data.nearbyText = resolveNearbyText(el);

    // --- Classify widget type ---
    data.classifiedAs = classifyWidget(el, data);

    return data;
  }

  function resolveLabel(el) {
    // 1. <label for="id">
    if (el.id) {
      const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel) return forLabel.textContent.trim().replace(/\s+/g, ' ');
    }

    // 2. aria-labelledby
    const labelledById = el.getAttribute('aria-labelledby');
    if (labelledById) {
      const ref = document.getElementById(labelledById);
      if (ref) return ref.textContent.trim().replace(/\s+/g, ' ');
    }

    // 3. Previous sibling <span> or <label>
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN') {
        const text = prev.textContent.trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length < 200) return text;
      }
      // Also check for a label/span inside the previous sibling
      const inner = prev.querySelector('label, span');
      if (inner) {
        const text = inner.textContent.trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length < 200) return text;
      }
      prev = prev.previousElementSibling;
    }

    // 4. Parent container's direct text nodes
    const parent = el.parentElement;
    if (parent) {
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim().replace(/\s+/g, ' ');
          if (text.length > 0 && text.length < 200) return text;
        }
      }
    }

    return null;
  }

  function resolveNearbyText(el) {
    const candidates = [];

    // Previous text node sibling
    let prevNode = el.previousSibling;
    if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
      candidates.push(prevNode.textContent.trim());
    }

    // Parent's previous sibling text
    const parentPrev = el.parentElement?.previousSibling;
    if (parentPrev && parentPrev.nodeType === Node.TEXT_NODE) {
      candidates.push(parentPrev.textContent.trim());
    }

    // Grandparent direct text (for deeply nested Workday structures)
    const grandparent = el.parentElement?.parentElement;
    if (grandparent) {
      for (const node of grandparent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim();
          if (t.length > 0) candidates.push(t);
        }
      }
    }

    // Pick the longest meaningful candidate
    const best = candidates
      .filter(c => c.length > 0)
      .sort((a, b) => b.length - a.length)[0];

    if (!best) return null;
    return best.length > MAX_NEARBY_TEXT ? best.substring(0, MAX_NEARBY_TEXT) + '...' : best;
  }

  function isElementVisible(el) {
    if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
      // offsetParent is null for hidden elements, unless fixed/sticky positioned
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') {
        return false;
      }
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;

    return true;
  }

  function classifyWidget(el, data) {
    const tag = data.tagName;
    const type = data.type;
    const role = data.role;
    const wType = data.widgetType;
    const autoId = data.automationId || '';

    // Priority-ordered classification
    if (type === 'file') return 'file_upload';
    if (type === 'radio' || role === 'radio') return 'radio';
    if (type === 'checkbox' || role === 'checkbox') return 'checkbox';
    if (wType === 'multiselect' || el.hasAttribute('multiple')) return 'multiselect';
    if (wType === 'date' || autoId.toLowerCase().includes('date') || autoId.toLowerCase().includes('Date')) return 'date_picker';
    if (role === 'combobox' || role === 'listbox' || tag === 'select' || wType === 'dropdown') return 'dropdown';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'button' || role === 'button') {
      if (autoId === 'add-button') return 'repeatable_control';
      return 'button';
    }
    if (autoId === 'add-button') return 'repeatable_control';
    if (role === 'spinbutton') return 'date_picker';

    return 'text_input';
  }

  function detectCurrentStep() {
    const steps = [
      { id: 'applyFlowMyInfoPage', name: 'My Information' },
      { id: 'applyFlowMyExpPage', name: 'My Experience' },
      { id: 'applyFlowPrimaryQuestionsPage', name: 'Application Questions' },
      { id: 'applyFlowVoluntaryDisclosuresPage', name: 'Voluntary Disclosures' },
      { id: 'applyFlowReviewPage', name: 'Review' }
    ];

    for (const step of steps) {
      if (document.querySelector(`[data-automation-id="${step.id}"]`)) {
        return { automationId: step.id, name: step.name };
      }
    }

    // Check for login
    if (document.querySelector('[data-automation-id="socialAuth"]') ||
        document.querySelector('[data-automation-id="loginForm"]')) {
      return { automationId: 'login', name: 'Login' };
    }

    return { automationId: null, name: 'Unknown' };
  }

  // --- Main ---
  function main() {
    const selectors = [
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="spinbutton"]',
      '[role="option"]',
      '[role="button"]',
      'button',
      '[data-automation-id*="formField"]',
      '[data-automation-id="add-button"]',
      '[data-uxi-widget-type]'
    ];

    const elements = new Set();
    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          elements.add(el);
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    const step = detectCurrentStep();
    const collected = [];

    for (const el of elements) {
      collected.push(collectElementData(el));
    }

    // Sort by widget type then by automationId for readability
    collected.sort((a, b) => {
      if (a.classifiedAs !== b.classifiedAs) return a.classifiedAs.localeCompare(b.classifiedAs);
      return (a.automationId || 'zzz').localeCompare(b.automationId || 'zzz');
    });

    // Summary
    const byWidgetType = {};
    let requiredCount = 0;
    let visibleCount = 0;
    for (const el of collected) {
      byWidgetType[el.classifiedAs] = (byWidgetType[el.classifiedAs] || 0) + 1;
      if (el.required) requiredCount++;
      if (el.isVisible) visibleCount++;
    }

    const output = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      step: step,
      elements: collected,
      summary: {
        total: collected.length,
        visible: visibleCount,
        requiredFields: requiredCount,
        byWidgetType
      }
    };

    // Output
    const json = JSON.stringify(output, null, 2);

    if (typeof copy === 'function') {
      copy(json);
      console.log('%c[DOM Inspector] JSON copied to clipboard. Paste into docs/dom-notes.json.', 'color: #28a745; font-weight: bold;');
    } else {
      console.log('[DOM Inspector] copy() not available. Copy the output below manually.');
    }

    console.log(json);

    return output;
  }

  return main();
})();
