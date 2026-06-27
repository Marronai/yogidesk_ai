const requireHttpsUrl = (value: string, label: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  return parsed.toString();
};

export const appConfig = {
  apiBaseUrl: requireHttpsUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.yogidesk-ai.com/api',
    'API URL',
  ).replace(/\/$/, ''),
  signupUrl: requireHttpsUrl(
    process.env.EXPO_PUBLIC_SIGNUP_URL ?? 'https://www.yogidesk-ai.com/signup',
    'Sign-up URL',
  ),
  rechargeUrl: requireHttpsUrl(
    process.env.EXPO_PUBLIC_BILLING_URL ?? 'https://www.yogidesk-ai.com/dashboard/ai-recharge',
    'Billing URL',
  ),
} as const;
