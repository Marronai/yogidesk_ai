import { ensureWallet } from './wallet';

export const getStoredAuthToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

export const getStoredUserId = () => localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

export const getStoredUserEmail = () => localStorage.getItem('user_email') || sessionStorage.getItem('user_email') || '';

export const clearStoredAuthSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user_id');
  sessionStorage.removeItem('user_email');
};

export const persistSupabaseSession = (user, overrides = {}) => {
  if (!user?.id) return;

  const metadata = user.user_metadata || {};
  const userName =
    overrides.name ||
    metadata.full_name ||
    metadata.name ||
    metadata.business_name ||
    'Doctor';
  const businessCategory =
    overrides.businessCategory ||
    metadata.business_category ||
    metadata.businessCategory ||
    'Clinic';
  const clinicName =
    overrides.clinicName ||
    overrides.businessName ||
    metadata.clinic_name ||
    metadata.business_name ||
    metadata.businessName ||
    '';
  const role = overrides.role || metadata.role || metadata.user_role || metadata.account_role || 'doctor';

  localStorage.setItem('user_id', user.id);
  localStorage.setItem('user_email', user.email || overrides.email || '');
  localStorage.setItem('user_name', userName);
  localStorage.setItem('clinic_name', clinicName || `${userName}'s Clinic`);
  localStorage.setItem('user_phone', overrides.phone || metadata.phone || '');
  localStorage.setItem('user_role', String(role).toUpperCase() === 'STAFF' ? 'STAFF' : 'doctor');
  localStorage.setItem('user_business_category', businessCategory);
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');

  ensureWallet({ welcomeGift: Boolean(overrides.welcomeGift) });
};
