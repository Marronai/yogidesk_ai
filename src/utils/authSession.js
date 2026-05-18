import { ensureWallet } from './wallet';

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

  localStorage.setItem('user_id', user.id);
  localStorage.setItem('user_email', user.email || overrides.email || '');
  localStorage.setItem('user_name', userName);
  localStorage.setItem('user_role', 'doctor');
  localStorage.setItem('user_business_category', businessCategory);
  localStorage.setItem('token', `supabase-bypass-token-${user.id}`);

  ensureWallet({ welcomeGift: Boolean(overrides.welcomeGift) });
};
