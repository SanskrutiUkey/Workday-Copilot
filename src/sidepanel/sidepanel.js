import { parseResume, parseResumeWithAI, normalizeProfile } from '../lib/resumeParser.js';
import { getProfile, setProfile, getApiKey, setApiKey, getLog, appendLog, clearLog } from '../lib/store.js';

let currentProfile = null;
let isRunning = false;
let lastResumeFile = null;
let lastFillResults = [];

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupTabs();
  setupDropZone();
  setupProfileEditor();
  setupSettings();
  setupAutofill();
  setupReview();
  setupLog();
  loadExistingProfile();
  loadLog();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
    });
  });
}

function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  });
}

async function handleFileUpload(file) {
  const status = document.getElementById('upload-status');
  status.className = 'status info';
  status.textContent = 'Parsing resume...';
  status.classList.remove('hidden');

  try {
    const rawText = await parseResume(file);
    status.textContent = 'Extracting structured data with AI...';

    lastResumeFile = await fileToPayload(file);
    const profile = normalizeProfile(await parseResumeWithAI(rawText));
    currentProfile = profile;

    await setProfile(profile);
    await appendLog({ type: 'info', message: `Resume parsed: ${profile.name.first} ${profile.name.last}` });

    status.className = 'status success';
    status.textContent = `Parsed: ${profile.name.first} ${profile.name.last} - ${profile.email}`;

    renderProfilePreview(profile);
    document.getElementById('btn-autofill').disabled = false;
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Error: ${error.message}`;
    await appendLog({ type: 'error', message: error.message });
  }
}

function renderProfilePreview(profile) {
  const container = document.getElementById('profile-preview');
  if (!profile) {
    container.innerHTML = '<p class="muted">No profile data</p>';
    return;
  }

  container.innerHTML = `
    <div class="section-title">Personal Info</div>
    <div class="field"><span class="field-label">Name</span><span class="field-value">${profile.name.first} ${profile.name.middle || ''} ${profile.name.last}</span></div>
    <div class="field"><span class="field-label">Email</span><span class="field-value">${profile.email || 'N/A'}</span></div>
    <div class="field"><span class="field-label">Phone</span><span class="field-value">${profile.phone?.countryCode || ''} ${profile.phone?.number || 'N/A'}</span></div>
    <div class="field"><span class="field-label">Address</span><span class="field-value">${profile.address?.line1 || ''}, ${profile.address?.city || ''}, ${profile.address?.state || ''} ${profile.address?.postalCode || ''}</span></div>

    <div class="section-title">Experience</div>
    ${(profile.experience || []).map(exp => `
      <div class="field"><span class="field-label">${exp.jobTitle}</span><span class="field-value">${exp.company} (${exp.startDate} - ${exp.current ? 'Present' : exp.endDate})</span></div>
    `).join('') || '<div class="field"><span class="field-value muted">No experience found</span></div>'}

    <div class="section-title">Education</div>
    ${(profile.education || []).map(edu => `
      <div class="field"><span class="field-label">${edu.degree}</span><span class="field-value">${edu.school} (${edu.startDate} - ${edu.endDate})</span></div>
    `).join('') || '<div class="field"><span class="field-value muted">No education found</span></div>'}

    <div class="section-title">Skills</div>
    <div class="field"><span class="field-value">${(profile.skills || []).join(', ') || 'None listed'}</span></div>
  `;

}

function setupProfileEditor() {
  const editor = document.getElementById('profile-editor');
  const saveBtn = document.getElementById('btn-save-profile');

  saveBtn.addEventListener('click', async () => {
    try {
      const profile = normalizeProfile(JSON.parse(editor.value));
      currentProfile = profile;
      editor.value = JSON.stringify(profile, null, 2);
      await setProfile(profile);
      renderProfilePreview(profile);
      await appendLog({ type: 'info', message: 'Profile updated manually' });

      const status = document.getElementById('upload-status');
      status.className = 'status success';
      status.textContent = 'Profile saved';
      status.classList.remove('hidden');
    } catch (e) {
      const status = document.getElementById('upload-status');
      status.className = 'status error';
      status.textContent = 'Invalid JSON: ' + e.message;
      status.classList.remove('hidden');
    }
  });

}

function setupSettings() {
  const saveKeyBtn = document.getElementById('btn-save-key');
  const keyStatus = document.getElementById('key-status');

  saveKeyBtn.addEventListener('click', async () => {
    const key = document.getElementById('api-key').value.trim();
    if (!key) {
      keyStatus.className = 'status error';
      keyStatus.textContent = 'Please enter an API key';
      keyStatus.classList.remove('hidden');
      return;
    }

    await setApiKey(key);
    keyStatus.className = 'status success';
    keyStatus.textContent = 'API key saved';
    keyStatus.classList.remove('hidden');
    await appendLog({ type: 'info', message: 'API key updated' });
  });

  getApiKey().then(key => {
    if (key) {
      document.getElementById('api-key').value = key;
      keyStatus.className = 'status success';
      keyStatus.textContent = 'API key configured';
      keyStatus.classList.remove('hidden');
    }
  });
}

function setupAutofill() {
  const startBtn = document.getElementById('btn-autofill');
  const stopBtn = document.getElementById('btn-stop');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressLog = document.getElementById('progress-log');

  startBtn.addEventListener('click', async () => {
    if (!currentProfile) {
      const status = document.getElementById('upload-status');
      status.className = 'status error';
      status.textContent = 'Please upload a resume first';
      status.classList.remove('hidden');
      return;
    }

    isRunning = true;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    progressSection.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting...';
    progressLog.innerHTML = '';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url.includes('myworkdayjobs.com')) {
        throw new Error('Please navigate to a Workday job application page first');
      }

      progressText.textContent = 'Connecting to page...';

      const pingContentScript = () => new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
          if (chrome.runtime.lastError || !response?.alive) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });

      let alive = await pingContentScript();

      if (!alive) {
        progressText.textContent = 'Content script not found, injecting...';
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
                if (msg.type === 'PING') { sendResponse({ alive: true }); return false; }
              });
            }
          });
        } catch (injectErr) {
          console.warn('executeScript failed:', injectErr);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        alive = await pingContentScript();
      }

      if (!alive) {
        throw new Error('Content script could not be loaded. Please refresh the Workday page and try again.');
      }

      const sendWithRetry = async (retries = 2, delay = 800) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          if (attempt > 0) {
            progressText.textContent = `Retrying connection (attempt ${attempt + 1})...`;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'START_AUTOFILL',
              resumeJson: currentProfile,
              resumeFile: lastResumeFile
            }, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ error: chrome.runtime.lastError.message });
              } else {
                resolve(response);
              }
            });
          });
          if (!response?.error) return response;
        }
        return { error: 'Could not connect to the page. Please refresh the Workday page and try again.' };
      };

      progressText.textContent = 'Starting autofill...';
      const response = await sendWithRetry();

      isRunning = false;
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');

      if (response?.error && !response?.success) {
        progressText.textContent = 'Error: ' + response.error;
        return;
      }

      if (response?.success) {
        progressFill.style.width = '100%';
        progressText.textContent = `Complete: ${response.successful}/${response.totalFields} filled, ${response.flagged} flagged`;
        if (response.results) renderReview(response.results);
        if (response.isReview) {
          progressText.textContent += ' — confirm in Review tab before submit';
          document.querySelector('[data-tab="review"]')?.click();
        }
      } else {
        progressText.textContent = 'Error: ' + (response?.error || 'Unknown error');
      }
    } catch (error) {
      isRunning = false;
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      progressText.textContent = 'Error: ' + error.message;
    }
  });

  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTOFILL' });
    }
    isRunning = false;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    progressText.textContent = 'Stopped';
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AUTOFILL_PROGRESS' && msg.payload) {
      const { type, step, successful, failed, message } = msg.payload;

      if (type === 'step_started') {
        progressText.textContent = `Processing: ${step}`;
        const stepIndex = ['applyFlowMyInfoPage', 'applyFlowMyExpPage', 'applyFlowPrimaryQuestionsPage', 'applyFlowVoluntaryDisclosuresPage'].indexOf(step);
        if (stepIndex >= 0) {
          progressFill.style.width = `${((stepIndex + 1) / 4) * 100}%`;
        }
      }

      if (type === 'step_completed') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${failed > 0 ? 'error' : 'success'}`;
        entry.textContent = `${step}: ${successful} filled, ${failed} failed`;
        progressLog.appendChild(entry);
        progressLog.scrollTop = progressLog.scrollHeight;
      }

      if (type === 'login_required') {
        progressText.textContent = 'Waiting for login...';
        progressLog.innerHTML += '<div class="log-entry warn">Please sign in to your Workday account</div>';
      }

      if (type === 'review_reached') {
        progressFill.style.width = '100%';
        progressText.textContent = 'Stopped before submit — confirm in Review tab';
        if (msg.payload.results) renderReview(msg.payload.results);
      }

      if (type === 'error') {
        progressText.textContent = `Error: ${message}`;
        const entry = document.createElement('div');
        entry.className = 'log-entry error';
        entry.textContent = message;
        progressLog.appendChild(entry);
      }
    }
  });
}

function setupLog() {
  const clearBtn = document.getElementById('btn-clear-log');
  clearBtn.addEventListener('click', async () => {
    await clearLog();
    document.getElementById('log-container').innerHTML = '';
  });
}

async function loadLog() {
  const log = await getLog();
  const container = document.getElementById('log-container');
  container.innerHTML = '';

  for (const entry of log.slice(-100)) {
    const div = document.createElement('div');
    div.className = `log-entry ${entry.type || ''}`;
    const time = new Date(entry.timestamp).toLocaleTimeString();
    div.innerHTML = `<span class="timestamp">[${time}]</span> ${entry.message}`;
    container.appendChild(div);
  }

  container.scrollTop = container.scrollHeight;
}

async function loadExistingProfile() {
  const profile = await getProfile();
  if (profile) {
    currentProfile = normalizeProfile(profile);
    renderProfilePreview(currentProfile);
    document.getElementById('profile-editor').value = JSON.stringify(currentProfile, null, 2);
    document.getElementById('btn-autofill').disabled = false;
  }
}

async function fileToPayload(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { name: file.name, type: file.type, buffer: btoa(binary) };
}

function renderReview(results) {
  lastFillResults = results || [];
  const container = document.getElementById('review-list');
  if (!container) return;
  if (!lastFillResults.length) {
    container.innerHTML = '<p class="muted">No fill results yet</p>';
    return;
  }

  const ranked = [...lastFillResults].sort((a, b) => {
    const score = (r) => (!r.success || r.method === 'ai_flagged' || r.method === 'inference_blocked' ? 0 : 1);
    return score(a) - score(b);
  });

  container.innerHTML = ranked.map(r => {
    const flagged = r.method === 'ai_flagged' || r.method === 'inference_blocked' || !r.success;
    const cls = !r.success && r.method !== 'already_filled' ? 'fail' : (flagged ? 'flagged' : '');
    const val = r.value === null || r.value === undefined || r.value === '' ? '(empty)' : (Array.isArray(r.value) ? r.value.join(', ') : String(r.value));
    return `<div class="review-row ${cls}">
      <div class="rv-label">${escapeHtml(r.label || r.automationId || '')}</div>
      <div class="rv-meta">${escapeHtml(val)}</div>
      <div class="rv-meta">${escapeHtml(r.method || '')} · conf ${r.confidence ?? '—'} ${r.success ? '· filled' : '· not filled'}</div>
    </div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setupReview() {
  const box = document.getElementById('confirm-submit');
  const btn = document.getElementById('btn-submit');
  const status = document.getElementById('submit-status');

  box.addEventListener('change', () => {
    btn.disabled = !box.checked;
  });

  btn.addEventListener('click', async () => {
    if (!box.checked) return;
    status.className = 'status info';
    status.textContent = 'Submitting...';
    status.classList.remove('hidden');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url.includes('myworkdayjobs.com')) {
        throw new Error('Open the Workday application tab first');
      }
      chrome.tabs.sendMessage(tab.id, { type: 'CLICK_SUBMIT' }, (response) => {
        if (chrome.runtime.lastError) {
          status.className = 'status error';
          status.textContent = chrome.runtime.lastError.message;
          return;
        }
        if (response?.success) {
          status.className = 'status success';
          status.textContent = 'Submit clicked';
        } else {
          status.className = 'status error';
          status.textContent = response?.error || 'Submit failed';
        }
      });
    } catch (e) {
      status.className = 'status error';
      status.textContent = e.message;
    }
  });
}
