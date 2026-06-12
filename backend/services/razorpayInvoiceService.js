const META_FEE_RATE = 0.0236;

const calculateMetaFee = (amount) => Number((Number(amount || 0) * META_FEE_RATE).toFixed(2));

const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

const normalizeInvoiceContact = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

module.exports = {
  META_FEE_RATE,
  calculateMetaFee,
  normalizeInvoiceContact,
  toPaise,
};
