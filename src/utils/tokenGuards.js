export const isJwtSegmentToken = (token) => {
  const value = String(token || '').trim();
  if (!value || value === 'undefined' || value === 'null') return false;
  return value.split('.').length === 3;
};

export const readTokenFromStorageValue = (storedValue) => {
  const rawValue = String(storedValue || '').trim();
  if (!rawValue) return null;
  if (isJwtSegmentToken(rawValue)) return rawValue;

  try {
    const parsed = JSON.parse(rawValue);
    const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
    return isJwtSegmentToken(token) ? token : null;
  } catch {
    return null;
  }
};
