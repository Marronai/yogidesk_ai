export const QUICK_REPLY_VARIABLES = ['{{DOCTOR_NAME}}', '{{CLINIC_NAME}}', '{{PATIENT_NAME}}'];

const QUICK_REPLY_STORAGE_PREFIX = 'yogidesk_quick_replies';
const SQL_CONTROL_PATTERN = /(--|\/\*|\*\/|;|\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|TRUNCATE|UNION|UPDATE)\b)/gi;
const HTML_ENTITY_BRACKET_PATTERN = /(&lt;|&gt;|&#60;|&#62;)/gi;

export const quickReplyStorageKey = (workspaceId) => `${QUICK_REPLY_STORAGE_PREFIX}_${String(workspaceId || 'default').replace(/[^\w-]/g, '') || 'default'}`;

export const sanitizeQuickReplyText = (value, maxLength = 1024) => String(value || '')
  .replace(HTML_ENTITY_BRACKET_PATTERN, '')
  .replace(/<[^>]*>/g, '')
  .replace(/[<>`]/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(SQL_CONTROL_PATTERN, '')
  .replace(/\$\{/g, '{')
  .replace(/\s+/g, ' ')
  .trimStart()
  .slice(0, maxLength);

export const sanitizeQuickReplyBody = (value) => {
  const protectedValue = QUICK_REPLY_VARIABLES.reduce((text, token, index) => (
    text.replaceAll(token, `__QR_VAR_${index}__`)
  ), String(value || ''));

  const sanitized = sanitizeQuickReplyText(protectedValue, 1024);
  return QUICK_REPLY_VARIABLES.reduce((text, token, index) => (
    text.replaceAll(`__QR_VAR_${index}__`, token)
  ), sanitized);
};

export const normalizeQuickReplyShortcut = (value) => sanitizeQuickReplyText(value, 40)
  .toLowerCase()
  .replace(/^\//, '')
  .replace(/[^a-z0-9_-]/g, '');

export const normalizeQuickReplyKeywords = (value) => sanitizeQuickReplyText(value, 240)
  .toLowerCase()
  .replace(/[^a-z0-9,_ -]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const sanitizeQuickReplyRecord = (record = {}) => ({
  id: sanitizeQuickReplyText(record.id || `qr_${Date.now()}`, 80).replace(/[^\w-]/g, ''),
  title: normalizeQuickReplyShortcut(record.title),
  keywords: normalizeQuickReplyKeywords(record.keywords),
  body: sanitizeQuickReplyBody(record.body),
  createdAt: sanitizeQuickReplyText(record.createdAt || new Date().toISOString(), 40),
  updatedAt: sanitizeQuickReplyText(record.updatedAt || new Date().toISOString(), 40),
});

export const validateQuickReplyRecord = (record = {}, existing = []) => {
  const clean = sanitizeQuickReplyRecord(record);
  if (!clean.title || clean.title.length < 2) return { ok: false, message: 'Short-key title needs at least 2 safe characters.' };
  if (!/^[a-z0-9_-]+$/.test(clean.title)) return { ok: false, message: 'Short-key title can use lowercase letters, numbers, underscore, or hyphen only.' };
  if (!clean.keywords || clean.keywords.length < 3) return { ok: false, message: 'Add a few safe keywords doctors can remember.' };
  if (!clean.body || clean.body.length < 3) return { ok: false, message: 'Template body cannot be empty.' };
  if (clean.body.length > 1024) return { ok: false, message: 'Template body must stay under 1024 characters.' };
  const duplicate = existing.some((item) => item.id !== clean.id && item.title === clean.title);
  if (duplicate) return { ok: false, message: 'That short-key already exists.' };
  return { ok: true, record: clean };
};

export const readQuickReplies = (workspaceId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(quickReplyStorageKey(workspaceId)) || '[]');
    return Array.isArray(parsed)
      ? parsed.map(sanitizeQuickReplyRecord).filter((item) => item.title && item.body)
      : [];
  } catch {
    return [];
  }
};

export const writeQuickReplies = (workspaceId, replies) => {
  const safeReplies = (Array.isArray(replies) ? replies : [])
    .map(sanitizeQuickReplyRecord)
    .filter((item) => item.title && item.body)
    .slice(0, 50);
  localStorage.setItem(quickReplyStorageKey(workspaceId), JSON.stringify(safeReplies));
  window.dispatchEvent(new CustomEvent('yogidesk:quick-replies-updated', {
    detail: { workspaceId: String(workspaceId || 'default') },
  }));
  return safeReplies;
};
