const isMalformedTokenLiteral = (token) => {
  const value = String(token || '').trim().toLowerCase();
  return !value || value === 'undefined' || value === 'null';
};

const isJwtSegmentToken = (token) => {
  const value = String(token || '').trim();
  return !isMalformedTokenLiteral(value) && value.split('.').length === 3;
};

const getBearerToken = (req) => {
  const header = String(req?.headers?.authorization || '').trim();
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
};

const rejectMalformedBearer = (res, message = 'Access token is malformed') => res.status(401).json({
  error: message,
  details: 'Invalid segment layout detected',
});

module.exports = {
  getBearerToken,
  isJwtSegmentToken,
  isMalformedTokenLiteral,
  rejectMalformedBearer,
};
