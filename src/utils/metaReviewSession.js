export const META_REVIEWER_EMAIL = 'meta-tester@yogidesk-ai.com';

export const normalizeReviewEmail = (email) => String(email || '').trim().toLowerCase();

export const isMetaReviewEmail = (email) => normalizeReviewEmail(email) === META_REVIEWER_EMAIL;

export const isMetaReviewUser = (user) => isMetaReviewEmail(user?.email);

export const getStoredMetaReviewSession = () => {
  if (typeof window === 'undefined') return false;
  return isMetaReviewEmail(
    localStorage.getItem('user_email') ||
    sessionStorage.getItem('user_email') ||
    ''
  );
};

export const blockLiveSupportWidgetsForMetaReview = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ['Tawk_API', 'Tawk_LoadStart', '$crisp', 'CRISP_WEBSITE_ID', 'Intercom'].forEach((key) => {
    try {
      window[key] = undefined;
    } catch {
      // Keep the compatibility mask silent.
    }
  });

  document
    .querySelectorAll('script[src*="tawk"],script[src*="crisp"],script[src*="intercom"],iframe[src*="tawk"],iframe[src*="crisp"],iframe[src*="intercom"]')
    .forEach((node) => node.remove());
};
