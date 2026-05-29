const axios = require('axios');

const SYNC_INTERVAL_MS = 2000;
const FINAL_META_STATUSES = new Set(['APPROVED', 'REJECTED']);
const PENDING_LOCAL_STATUSES = ['PENDING_APPROVAL', 'PENDING_REVIEW', 'PENDING'];

let intervalId = null;
let isRunning = false;

const isMissingColumnError = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const unique = (items) => [...new Set((items || []).filter(Boolean))];

const fetchCredentialRows = async (supabase, userIds) => {
  const credentialsByUser = new Map();

  const credentialLookups = [{
    select: '*',
    map: (row) => ({
      userId: row.id,
      accessToken: row.system_user_token || row.whatsapp_access_token,
      businessAccountId: row.meta_waba_id || row.whatsapp_business_account_id
    })
  }];

  for (const lookup of credentialLookups) {
    const { data, error } = await supabase
      .from('doctor_profiles')
      .select(lookup.select)
      .in('id', userIds);

    if (error) {
      if (isMissingColumnError(error)) continue;
      console.error('Meta sync credential lookup failed:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      continue;
    }

    (data || []).forEach((row) => {
      const credentials = lookup.map(row);
      if (!credentials.userId || !credentials.accessToken || !credentials.businessAccountId) return;
      if (!credentialsByUser.has(credentials.userId)) {
        credentialsByUser.set(credentials.userId, credentials);
      }
    });
  }

  return credentialsByUser;
};

const updateLocalTemplateStatus = async ({ supabase, userId, templateName, status }) => {
  const updates = [
    supabase
      .from('submitted_meta_templates')
      .update({ status })
      .eq('template_name', templateName)
      .eq('user_id', userId),
    supabase
      .from('whatsapp_templates')
      .update({ status })
      .eq('template_name', templateName)
      .eq('user_id', userId)
  ];

  const results = await Promise.allSettled(updates);
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value?.error) {
      console.error('Meta sync local status update failed:', {
        templateName,
        status,
        message: result.value.error.message,
        details: result.value.error.details,
        hint: result.value.error.hint,
        code: result.value.error.code
      });
    }
    if (result.status === 'rejected') {
      console.error('Meta sync local status update crashed:', result.reason?.message || result.reason);
    }
  });
};

const runMetaTemplateSync = async ({ supabase }) => {
  if (isRunning) return;
  isRunning = true;

  try {
    if (!supabase?.from) return;

    const { data: pendingTemplates, error: pendingError } = await supabase
      .from('submitted_meta_templates')
      .select('user_id,template_name,status')
      .in('status', PENDING_LOCAL_STATUSES);

    if (pendingError) {
      console.error('Meta sync pending template lookup failed:', {
        message: pendingError.message,
        details: pendingError.details,
        hint: pendingError.hint,
        code: pendingError.code
      });
      return;
    }

    const pendingRows = Array.isArray(pendingTemplates) ? pendingTemplates : [];
    if (!pendingRows.length) return;

    const userIds = unique(pendingRows.map((row) => row.user_id));
    const credentialsByUser = await fetchCredentialRows(supabase, userIds);
    const pendingNamesByUser = new Map();

    pendingRows.forEach((row) => {
      if (!row.user_id || !row.template_name) return;
      if (!pendingNamesByUser.has(row.user_id)) pendingNamesByUser.set(row.user_id, new Set());
      pendingNamesByUser.get(row.user_id).add(row.template_name);
    });

    for (const [userId, templateNames] of pendingNamesByUser.entries()) {
      const credentials = credentialsByUser.get(userId);
      if (!credentials?.accessToken || !credentials?.businessAccountId) continue;

      try {
        const url = `https://graph.facebook.com/v19.0/${credentials.businessAccountId}/message_templates`;
        const response = await axios.get(url, {
          params: { access_token: credentials.accessToken },
          timeout: 12000
        });

        const metaTemplates = Array.isArray(response.data?.data) ? response.data.data : [];
        for (const metaTemplate of metaTemplates) {
          const templateName = metaTemplate?.name;
          const status = String(metaTemplate?.status || '').toUpperCase();
          if (!templateName || !templateNames.has(templateName) || !FINAL_META_STATUSES.has(status)) continue;

          await updateLocalTemplateStatus({
            supabase,
            userId,
            templateName,
            status
          });
        }
      } catch (error) {
        console.error('Meta sync polling failed for account:', {
          userId,
          businessAccountId: credentials.businessAccountId,
          message: error.response?.data?.error?.message || error.message || 'Unknown Meta sync error'
        });
      }
    }
  } catch (error) {
    console.error('Meta sync worker error:', error.message || error);
  } finally {
    isRunning = false;
  }
};

const startMetaSyncWorker = ({ supabase }) => {
  if (intervalId) return { stop: stopMetaSyncWorker };

  intervalId = setInterval(() => {
    runMetaTemplateSync({ supabase });
  }, SYNC_INTERVAL_MS);

  runMetaTemplateSync({ supabase });
  console.log(`Meta template sync worker started (${SYNC_INTERVAL_MS}ms interval).`);
  return { stop: stopMetaSyncWorker };
};

const stopMetaSyncWorker = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  isRunning = false;
};

module.exports = {
  startMetaSyncWorker,
  stopMetaSyncWorker,
  runMetaTemplateSync
};
