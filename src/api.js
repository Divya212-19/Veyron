// Get backend API URL from environment variables
// In production: https://veyron-backend.onrender.com/api
// In development: http://127.0.0.1:8000/api
const BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000/api';

async function parseResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.detail || 'Request failed. Please try again.');
  }
  return data;
}

async function request(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(res);
}

async function requestForm(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  });
  return parseResponse(res);
}

export async function chatWithSaathi(message, history = [], language = 'English') {
  return request('/chat', { message, history, language });
}

export async function checkEmail(email) {
  return request('/check-email', { email });
}

export async function scanLink(url) {
  return request('/scan-link', { url });
}

export async function checkApp(appName, packageName) {
  return request('/check-app', { appName, packageName });
}

export async function detectDeepfake(fileOrUrl) {
  if (typeof fileOrUrl === 'string') {
    const form = new FormData();
    form.append('mediaUrl', fileOrUrl);
    return requestForm('/detect-deepfake', form);
  }
  const form = new FormData();
  form.append('file', fileOrUrl);
  return requestForm('/detect-deepfake', form);
}

export async function getHelplines(incidentType, userState) {
  return request('/get-helplines', { incidentType, userState });
}

export async function getCyberCell({ state, lat, lng } = {}) {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (typeof lat === 'number') params.set('lat', String(lat));
  if (typeof lng === 'number') params.set('lng', String(lng));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/get-cybercell${suffix}`, {});
}
