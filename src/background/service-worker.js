import { getApiKey } from '../lib/store.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AI_REQUEST') {
    handleAIRequest(msg.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (msg.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
    sendResponse({ success: true });
    return false;
  }
});

async function handleAIRequest(payload) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please set it in the side panel.');
  }

  const { model, contents, systemInstruction, generationConfig } = payload;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (generationConfig) body.generationConfig = generationConfig;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`Gemini API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('No response from Gemini API');
}

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
