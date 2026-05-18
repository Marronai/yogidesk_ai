const FIREBASE_COMPAT_APP_SRC = 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js';
const FIREBASE_COMPAT_AUTH_SRC = 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js';

const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    existing.addEventListener('load', resolve, { once: true });
    existing.addEventListener('error', reject, { once: true });
    if (existing.dataset.loaded === 'true') resolve();
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.loaded = 'false';
  script.onload = () => {
    script.dataset.loaded = 'true';
    resolve();
  };
  script.onerror = reject;
  document.head.appendChild(script);
});

const getFirebaseConfig = () => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Firebase phone auth is missing configuration: ${missing.join(', ')}`);
  }

  return config;
};

export const normalizeFirebasePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('91') ? `+${digits}` : `+${digits}`;
};

export const startFirebasePhoneChallenge = async ({ phone, containerId, verifierKey = 'default', onVerified }) => {
  await loadScript(FIREBASE_COMPAT_APP_SRC);
  await loadScript(FIREBASE_COMPAT_AUTH_SRC);

  const firebase = window.firebase;
  if (!firebase?.auth) throw new Error('Firebase Auth could not be loaded.');

  if (!firebase.apps.length) firebase.initializeApp(getFirebaseConfig());

  const normalizedPhone = normalizeFirebasePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) throw new Error('A valid mobile number is required for OTP verification.');

  const container = document.getElementById(containerId);
  if (!container) throw new Error('Firebase reCAPTCHA container is missing.');

  const existingVerifier = window.__yogiFirebaseVerifiers?.[verifierKey];
  if (existingVerifier?.clear) existingVerifier.clear();
  container.innerHTML = '';

  const verifier = new firebase.auth.RecaptchaVerifier(containerId, {
    size: 'invisible',
    callback: onVerified || (() => {}),
  });

  window.__yogiFirebaseVerifiers = {
    ...(window.__yogiFirebaseVerifiers || {}),
    [verifierKey]: verifier,
  };

  await verifier.render();
  return firebase.auth().signInWithPhoneNumber(normalizedPhone, verifier);
};
