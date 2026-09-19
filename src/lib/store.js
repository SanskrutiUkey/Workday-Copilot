const STORE_KEYS = {
  PROFILE: 'autofill_profile',
  MAPPINGS: 'autofill_mappings',
  API_KEY: 'openai_api_key',
  LOG: 'autofill_log',
  SETTINGS: 'autofill_settings'
};

async function get(key) {
  return new Promise(resolve => {
    chrome.storage.local.get([key], result => resolve(result[key] || null));
  });
}

async function set(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function getProfile() {
  return (await get(STORE_KEYS.PROFILE));
}

export async function setProfile(profile) {
  return (await set(STORE_KEYS.PROFILE, profile));
}

export async function getMappings() {
  return (await get(STORE_KEYS.MAPPINGS)) || {};
}

export async function setMappings(mappings) {
  return (await set(STORE_KEYS.MAPPINGS, mappings));
}

export async function getApiKey() {
  return (await get(STORE_KEYS.API_KEY));
}

export async function setApiKey(key) {
  return (await set(STORE_KEYS.API_KEY, key));
}

export async function getLog() {
  return (await get(STORE_KEYS.LOG)) || [];
}

export async function appendLog(entry) {
  const log = await getLog();
  log.push({ ...entry, timestamp: Date.now() });
  if (log.length > 500) log.splice(0, log.length - 500);
  return set(STORE_KEYS.LOG, log);
}

export async function clearLog() {
  return set(STORE_KEYS.LOG, []);
}

export async function clearMappings() {
  return set(STORE_KEYS.MAPPINGS, {});
}
