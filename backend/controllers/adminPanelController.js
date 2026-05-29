const { supabase: sharedSupabase, supabaseAdmin } = require('../config/supabase');

const supabase = supabaseAdmin || sharedSupabase;

const isMissingColumnError = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const normalizeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

exports.getAdminSummary = async (req, res) => {
  try {
    const { error: activeCountError, count: activeClinicCount } = await supabase
      .from('doctor_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    let activeClinics = Number(activeClinicCount || 0);
    if (activeCountError && isMissingColumnError(activeCountError)) {
      const { data: allClinics, error: clinicFallbackError } = await supabase
        .from('doctor_profiles')
        .select('id, system_status');

      if (clinicFallbackError) throw clinicFallbackError;
      activeClinics = (allClinics || []).filter((clinic) => String(clinic.system_status || 'ACTIVE').toUpperCase() !== 'SUSPENDED').length;
    } else if (activeCountError) {
      throw activeCountError;
    }

    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('balance');

    if (walletError) {
      throw walletError;
    }

    const globalWalletBalance = (wallets || []).reduce((sum, row) => sum + normalizeNumber(row.balance), 0);

    const { data: analyticsRows, error: analyticsError } = await supabase
      .from('campaign_analytics')
      .select('sent_count');

    let totalAutomationTraffic = 0;
    if (!analyticsError) {
      totalAutomationTraffic = (analyticsRows || []).reduce((sum, row) => sum + normalizeNumber(row.sent_count), 0);
    } else if (isMissingColumnError(analyticsError)) {
      const { data: fallbackTraffic, error: fallbackTrafficError } = await supabase
        .from('campaign_analytics')
        .select('id');
      if (fallbackTrafficError) throw fallbackTrafficError;
      totalAutomationTraffic = (fallbackTraffic || []).length;
    } else {
      throw analyticsError;
    }

    return res.status(200).json({
      success: true,
      data: {
        activeClinicCount: activeClinics,
        globalWalletBalance: Number(globalWalletBalance.toFixed(2)),
        totalAutomationTraffic
      }
    });
  } catch (error) {
    console.error('Admin summary fetch failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to fetch admin summary.', error: error.message || 'Unknown error' });
  }
};

exports.getAdminClinics = async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('doctor_profiles')
      .select('id, name, email, clinic_name, created_at, system_status, status')
      .order('created_at', { ascending: false });

    if (clinicsError) throw clinicsError;

    const userIds = (clinics || []).map((clinic) => clinic.id).filter(Boolean);
    const walletMap = new Map();

    if (userIds.length) {
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('user_id, balance')
        .in('user_id', userIds);

      if (walletError) throw walletError;
      (wallets || []).forEach((wallet) => walletMap.set(wallet.user_id, normalizeNumber(wallet.balance)));
    }

    const enrichedClinics = (clinics || []).map((clinic) => ({
      id: clinic.id,
      name: clinic.name || 'Unknown',
      email: clinic.email || 'Unknown',
      clinic_name: clinic.clinic_name || 'Unknown',
      created_at: clinic.created_at,
      system_status: String(clinic.system_status || clinic.status || 'ACTIVE').toUpperCase(),
      wallet_balance: walletMap.get(clinic.id) || 0,
    }));

    return res.status(200).json({ success: true, data: enrichedClinics });
  } catch (error) {
    console.error('Admin clinic list failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to fetch clinic list.', error: error.message || 'Unknown error' });
  }
};

exports.updateClinicStatus = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const requestedStatus = String(req.body?.status || '').toUpperCase();
    const validStatuses = ['ACTIVE', 'SUSPENDED'];

    if (!clinicId || !validStatuses.includes(requestedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid clinic status request.' });
    }

    const { data, error } = await supabase
      .from('doctor_profiles')
      .update({ system_status: requestedStatus })
      .or(`id.eq.${clinicId},user_id.eq.${clinicId}`)
      .select('id, system_status');

    if (error) throw error;
    if (!data || !data.length) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }

    return res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Admin clinic status update failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to update clinic status.', error: error.message || 'Unknown error' });
  }
};

exports.getTransactionLogs = async (req, res) => {
  try {
    const { data: transactions, error: transactionError } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, amount, transaction_type, description, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (transactionError) throw transactionError;

    const userIds = [...new Set((transactions || []).map((row) => row.user_id).filter(Boolean))];
    const doctorMap = new Map();

    if (userIds.length) {
      const { data: doctors, error: doctorError } = await supabase
        .from('doctor_profiles')
        .select('id, name, clinic_name')
        .in('id', userIds);

      if (doctorError) throw doctorError;
      (doctors || []).forEach((doctor) => {
        doctorMap.set(doctor.id, {
          doctorName: doctor.name || 'Unknown',
          clinicName: doctor.clinic_name || 'Unknown'
        });
      });
    }

    const enrichedTransactions = (transactions || []).map((row) => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {});
      const doctor = doctorMap.get(row.user_id) || {};
      const inferredStatus = String(metadata.status || metadata.gateway_status || (row.transaction_type === 'CREDIT' ? 'SUCCESS' : 'FAILED')).toUpperCase();

      return {
        id: row.id,
        transaction_id: metadata.txnid || String(row.id),
        clinic_name: doctor.clinicName || 'Unknown',
        doctor_name: doctor.doctorName || 'Unknown',
        amount: normalizeNumber(row.amount),
        provider: String(metadata.provider || 'unknown').toUpperCase(),
        gateway_status: inferredStatus,
        description: row.description || '',
        created_at: row.created_at,
      };
    });

    return res.status(200).json({ success: true, data: enrichedTransactions });
  } catch (error) {
    console.error('Admin transaction logs failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to fetch transaction logs.', error: error.message || 'Unknown error' });
  }
};
