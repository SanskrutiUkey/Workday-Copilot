import { runAutofill, isReviewStep, clickSubmit, detectCurrentStep, discoverFields, setAbortSignal } from './navigator.js';
import { getProfile, appendLog, clearMappings } from '../lib/store.js';

let isRunning = false;
let abortController = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ alive: true });
    return false;
  }

  if (msg.type === 'START_AUTOFILL') {
    let responded = false;
    const safeSend = (data) => {
      if (!responded) { responded = true; sendResponse(data); }
    };
    const safetyTimeout = setTimeout(() => safeSend({ success: false, error: 'Autofill timed out after 60s' }), 60000);
    handleStartAutofill(msg.resumeJson, msg.resumeFile).then(result => {
      clearTimeout(safetyTimeout);
      safeSend(result);
    }).catch(error => {
      clearTimeout(safetyTimeout);
      safeSend({ success: false, error: error.message });
    });
    return true;
  }

  if (msg.type === 'STOP_AUTOFILL') {
    handleStopAutofill();
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'GET_STATUS') {
    sendResponse({
      isRunning,
      currentStep: detectCurrentStep(),
      isReview: isReviewStep()
    });
    return false;
  }

  if (msg.type === 'GET_FIELDS') {
    const fields = discoverFields();
    sendResponse({
      fields: fields.map(f => ({
        automationId: f.automationId,
        label: f.label,
        widgetType: f.widgetType,
        required: f.required,
        options: f.options,
        isRepeatable: f.isRepeatable,
        section: f.section || null
      }))
    });
    return false;
  }

  if (msg.type === 'CLICK_SUBMIT') {
    clickSubmit().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

async function handleStartAutofill(resumeJson, resumeFile) {
  if (isRunning) return { success: false, error: 'Already running' };

  isRunning = true;
  abortController = new AbortController();
  setAbortSignal(abortController.signal);

  try {
    await clearMappings();
    const profile = resumeJson || await getProfile();
    if (!profile) {
      throw new Error('No resume data found. Please upload a resume first.');
    }

    await appendLog({ type: 'info', message: 'Starting autofill...' });

    const results = await runAutofill(profile, (progress) => {
      chrome.runtime.sendMessage({
        type: 'AUTOFILL_PROGRESS',
        payload: progress
      }).catch(() => {});
    }, { signal: abortController.signal, resumeFile });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const flagged = results.filter(r => r.method === 'ai_flagged' || r.method === 'inference_blocked').length;

    const summary = {
      success: true,
      totalFields: results.length,
      successful,
      failed,
      flagged,
      isReview: true,
      results
    };

    await appendLog({
      type: 'complete',
      message: `Autofill complete: ${successful}/${results.length} filled, ${flagged} flagged`
    });

    return summary;
  } catch (error) {
    await appendLog({ type: 'error', message: error.message });
    return { success: false, error: error.message };
  } finally {
    isRunning = false;
    abortController = null;
    setAbortSignal(null);
  }
}

function handleStopAutofill() {
  if (abortController) {
    abortController.abort();
  }
  isRunning = false;
}
