const META_FEE_RATE = 0.0236;

const calculateMetaFee = (amount) => Number((Number(amount || 0) * META_FEE_RATE).toFixed(2));

const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

const normalizeInvoiceContact = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const createInvoiceReceipt = () => `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`.slice(0, 39);

const resolveDoctorBillingProfile = async ({ db, supabaseAdmin, userId, fallback = {} }) => {
  const base = {
    name: fallback.name || fallback.doctor_name || fallback.clinic_name || fallback.full_name || 'Doctor',
    email: fallback.email || fallback.doctor_email || '',
    contact: normalizeInvoiceContact(fallback.contact || fallback.phone || fallback.doctor_phone || ''),
    clinicName: fallback.clinic_name || fallback.clinicName || '',
  };

  if (!userId || !db?.from) return base;

  for (const table of ['doctor_profiles', 'profiles']) {
    try {
      const { data, error } = await db
        .from(table)
        .select('id,name,email,phone,phone_number,mobile,clinic_name')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data?.id) {
        return {
          name: data.name || data.clinic_name || base.name,
          email: data.email || base.email,
          contact: normalizeInvoiceContact(data.phone_number || data.phone || data.mobile || base.contact),
          clinicName: data.clinic_name || base.clinicName,
        };
      }
    } catch (error) {
      console.warn(`Razorpay invoice billing profile lookup skipped in ${table}:`, error.message || error);
    }
  }

  try {
    if (supabaseAdmin?.auth?.admin?.getUserById) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      const authUser = data?.user;
      if (!error && authUser?.id) {
        return {
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || base.name,
          email: authUser.email || base.email,
          contact: normalizeInvoiceContact(authUser.user_metadata?.phone || base.contact),
          clinicName: authUser.user_metadata?.clinic_name || authUser.user_metadata?.clinicName || base.clinicName,
        };
      }
    }
  } catch (error) {
    console.warn('Razorpay invoice auth profile lookup skipped:', error.message || error);
  }

  return base;
};

const createMetaFeeLineItem = (principalAmount) => ({
  name: 'Meta Fee (Infrastructure & Platform Charges)',
  description: 'Dynamic 2.36% infrastructure and platform processing allocation',
  amount: toPaise(calculateMetaFee(principalAmount)),
  currency: 'INR',
  quantity: 1,
});

const buildFixedPlanLineItems = ({ packageName, principalAmount }) => [
  {
    name: packageName,
    description: 'YogiDesk fixed plan package purchase',
    amount: toPaise(principalAmount),
    currency: 'INR',
    quantity: 1,
  },
  createMetaFeeLineItem(principalAmount),
];

const buildWalletRechargeLineItems = ({ principalAmount }) => [
  {
    name: 'Yogi Wallet Credit Addition - Custom AI Message Allocation',
    description: 'YogiDesk wallet principal credit addition',
    amount: toPaise(principalAmount),
    currency: 'INR',
    quantity: 1,
  },
  createMetaFeeLineItem(principalAmount),
];

const createRazorpayNativeInvoice = async ({
  razorpay,
  db,
  supabaseAdmin,
  userId,
  rechargeType,
  principalAmount,
  calculatedLineItems,
  customerFallback = {},
  notes = {},
  description = 'YogiDesk AI Assistant Platform Bill & Credits Receipt',
}) => {
  try {
    if (!razorpay?.invoices?.create) return null;
    const billing = await resolveDoctorBillingProfile({ db, supabaseAdmin, userId, fallback: customerFallback });
    const customer = {
      name: billing.name,
      ...(billing.email ? { email: billing.email } : {}),
      ...(billing.contact ? { contact: billing.contact } : {}),
    };
    const safePrincipal = Number(principalAmount || 0);
    const metaFee = calculateMetaFee(safePrincipal);

    return await razorpay.invoices.create({
      type: 'invoice',
      description,
      customer,
      line_items: calculatedLineItems,
      sms_notify: 1,
      email_notify: 1,
      currency: 'INR',
      receipt: createInvoiceReceipt(),
      notes: {
        brand: 'YogiDesk AI',
        recharge_type: rechargeType,
        clinic_name: billing.clinicName || customerFallback.clinic_name || '',
        doctor_email: billing.email || customerFallback.email || '',
        doctor_phone: billing.contact || customerFallback.phone || '',
        subtotal: safePrincipal.toFixed(2),
        meta_fee: metaFee.toFixed(2),
        total_amount: Number((safePrincipal + metaFee).toFixed(2)).toFixed(2),
        ...notes,
      },
    });
  } catch (error) {
    console.error('[YogiDesk Secure Payments] Razorpay invoice creation failed', {
      userId,
      rechargeType,
      message: error?.message || 'Unknown invoice error',
      providerError: error?.error || error?.response?.data || null,
    });
    return null;
  }
};

module.exports = {
  META_FEE_RATE,
  buildFixedPlanLineItems,
  buildWalletRechargeLineItems,
  calculateMetaFee,
  createMetaFeeLineItem,
  createRazorpayNativeInvoice,
  normalizeInvoiceContact,
  toPaise,
};
