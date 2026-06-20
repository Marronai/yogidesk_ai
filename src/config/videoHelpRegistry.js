const GENERAL_OVERVIEW_VIDEO_ID = 'GENERAL_OVERVIEW_VIDEO_ID';

export const videoHelpRegistry = {
  '/dashboard': GENERAL_OVERVIEW_VIDEO_ID,
  '/dashboard/inbox': 'INBOX_TUTORIAL_VIDEO_ID',
  '/dashboard/appointments': 'APPOINTMENTS_TUTORIAL_VIDEO_ID',
  '/dashboard/delivery-reports': 'DELIVERY_REPORTS_TUTORIAL_VIDEO_ID',
  '/dashboard/contacts': 'CONTACTS_TUTORIAL_VIDEO_ID',
  '/dashboard/settings': 'SETTINGS_TUTORIAL_VIDEO_ID',
  '/dashboard/ai-settings': 'AI_SETTINGS_TUTORIAL_VIDEO_ID',
  '/dashboard/ai-recharge': 'AI_RECHARGE_TUTORIAL_VIDEO_ID',
  '/dashboard/ads-crm': 'ADS_CRM_TUTORIAL_VIDEO_ID',
  '/dashboard/subscription': 'BILLING_TUTORIAL_VIDEO_ID',
  '/dashboard/wallet': 'WALLET_TUTORIAL_VIDEO_ID',
  '/campaigns': 'CAMPAIGNS_TUTORIAL_VIDEO_ID',
  '/templates': 'TEMPLATES_TUTORIAL_VIDEO_ID',
  '/team': 'TEAM_TUTORIAL_VIDEO_ID',
  default: GENERAL_OVERVIEW_VIDEO_ID,
};

export const getVideoHelpId = (pathname) => {
  if (videoHelpRegistry[pathname]) return videoHelpRegistry[pathname];

  const matchingRoute = Object.keys(videoHelpRegistry)
    .filter((route) => route !== 'default' && pathname.startsWith(`${route}/`))
    .sort((first, second) => second.length - first.length)[0];

  return videoHelpRegistry[matchingRoute] || videoHelpRegistry.default;
};

