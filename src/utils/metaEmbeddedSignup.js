const META_SDK_ID = 'facebook-jssdk';
const META_SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';

const loadMetaSdk = () => new Promise((resolve, reject) => {
  if (window.FB) {
    resolve(window.FB);
    return;
  }

  const existingScript = document.getElementById(META_SDK_ID);
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(window.FB), { once: true });
    existingScript.addEventListener('error', reject, { once: true });
    return;
  }

  window.fbAsyncInit = () => resolve(window.FB);

  const script = document.createElement('script');
  script.id = META_SDK_ID;
  script.src = META_SDK_URL;
  script.async = true;
  script.defer = true;
  script.crossOrigin = 'anonymous';
  script.onerror = reject;
  document.body.appendChild(script);
});

const readEmbeddedSignupMessage = (event) => {
  const origin = String(event.origin || '');
  if (!origin.endsWith('facebook.com') && !origin.endsWith('facebook.net')) return null;

  let payload = event.data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return null;
  return payload;
};

export const normalizeMetaEmbeddedSignupConfigId = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  if (/^\d+$/.test(rawValue)) return rawValue;

  try {
    const url = new URL(rawValue);
    const configId = url.searchParams.get('config_id') || url.searchParams.get('configuration_id');
    return /^\d+$/.test(String(configId || '')) ? configId : '';
  } catch {
    const match = rawValue.match(/[?&](?:config_id|configuration_id)=(\d+)/i);
    return match?.[1] || '';
  }
};

export const startMetaEmbeddedSignup = async ({ appId, configId }) => {
  const safeAppId = String(appId || '').trim();
  const safeConfigId = normalizeMetaEmbeddedSignupConfigId(configId);

  if (!safeAppId || !safeConfigId) {
    throw new Error('Meta Embedded Signup is not configured.');
  }

  const FB = await loadMetaSdk();
  FB.init({
    appId: safeAppId,
    cookie: true,
    xfbml: true,
    version: 'v21.0',
  });

  let embeddedSignupData = {};
  const messagePromise = new Promise((resolve) => {
    const listener = (event) => {
      const payload = readEmbeddedSignupMessage(event);
      if (!payload) return;
      if (payload.event === 'FINISH' || payload.event === 'CANCEL' || payload.event === 'ERROR') {
        window.removeEventListener('message', listener);
        resolve(payload);
      }
    };
    window.addEventListener('message', listener);
  });

  const loginPromise = new Promise((resolve) => {
    FB.login((response) => resolve(response), {
      config_id: safeConfigId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
      },
    });
  });

  const [loginResponse, messageResponse] = await Promise.all([loginPromise, messagePromise]);
  embeddedSignupData = messageResponse?.data || {};

  if (messageResponse?.event === 'CANCEL') throw new Error('WhatsApp connection was cancelled.');
  if (messageResponse?.event === 'ERROR') throw new Error(messageResponse?.data?.error_message || 'Meta signup failed.');

  const code = loginResponse?.authResponse?.code;
  if (!code) throw new Error('Meta did not return an authorization code.');

  return {
    code,
    phoneNumberId: embeddedSignupData.phone_number_id || '',
    businessAccountId: embeddedSignupData.waba_id || embeddedSignupData.whatsapp_business_account_id || '',
    businessId: embeddedSignupData.business_id || '',
  };
};
