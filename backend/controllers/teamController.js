// FILE: backend/controllers/teamController.js
const { supabaseAdmin, supabase } = require('../config/supabase');
const { sendDirectBrandMail } = require('../services/mailService');
const { getInviteEmailHTML } = require('../utils/emailTemplates');

const STAFF_MEMBERS_TABLE = 'staff_members';
const STAFF_INVITE_EXPIRY_DAYS = 3;
const STAFF_SLOT_SWAP_COOLDOWN_DAYS = 5;

const getDb = () => supabaseAdmin || supabase;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const addDaysIso = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

const resolveAdminId = (req) => req.user?.id || '';

const calculateCooldown = (lastStaffDeletedAt) => {
  if (!lastStaffDeletedAt) return { active: false, remainingDays: 0 };
  const deletedAtMs = new Date(lastStaffDeletedAt).getTime();
  if (!Number.isFinite(deletedAtMs)) return { active: false, remainingDays: 0 };
  const daysSinceLastDelete = (Date.now() - deletedAtMs) / (1000 * 60 * 60 * 24);
  return {
    active: daysSinceLastDelete < STAFF_SLOT_SWAP_COOLDOWN_DAYS,
    remainingDays: Math.max(0, Math.ceil(STAFF_SLOT_SWAP_COOLDOWN_DAYS - daysSinceLastDelete))
  };
};

const getClinic = async (db, adminId) => {
  const { data, error } = await db
    .from('clinics')
    .select('id, user_id, last_staff_deleted_at')
    .or(`user_id.eq.${adminId},id.eq.${adminId}`)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

const stampClinicStaffDeletedAt = async (db, adminId, deletedAt) => {
  const { error } = await db
    .from('clinics')
    .update({ last_staff_deleted_at: deletedAt })
    .or(`user_id.eq.${adminId},id.eq.${adminId}`);

  if (error) throw error;
};

// --- 1. ADD MEMBER (Admin & Manager Only) ---
exports.addTeamMember = async (req, res) => {
  try {
    const db = getDb();
    const adminId = resolveAdminId(req);
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const role = String(req.body?.role || 'STAFF').trim().toUpperCase();

    if (!db?.from) return res.status(500).json({ msg: 'Staff database service is unavailable.' });
    if (!adminId) return res.status(401).json({ msg: 'Authenticated doctor workspace is required.' });
    if (!name || !email) return res.status(400).json({ msg: 'Please enter Name and Email.' });

    const clinic = await getClinic(db, adminId);
    const cooldown = calculateCooldown(clinic?.last_staff_deleted_at);
    if (cooldown.active) {
      return res.status(400).json({
        msg: `Security Cooldown Active! You can add your next staff member after ${cooldown.remainingDays} days to prevent infinite account swapping abuse.`,
        cooldown
      });
    }

    const { data: existing, error: existingError } = await db
      .from(STAFF_MEMBERS_TABLE)
      .select('id, status, is_active, deleted_at')
      .eq('admin_id', adminId)
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) return res.status(400).json({ msg: 'Staff member already exists.' });

    const { data: member, error } = await db
      .from(STAFF_MEMBERS_TABLE)
      .insert([{
        admin_id: adminId,
        clinic_id: clinic?.id || adminId,
        name,
        email,
        role,
        status: 'PENDING',
        is_active: true,
        invite_expires_at: addDaysIso(new Date(), STAFF_INVITE_EXPIRY_DAYS)
      }])
      .select('id, admin_id, name, email, role, status, invite_expires_at, is_active, deleted_at, created_at')
      .single();

    if (error) throw error;

    const loginLink = process.env.FRONTEND_URL || 'https://yogidesk-ai.com/accept-invite';
    const inviteHTML = getInviteEmailHTML(name, loginLink, req.body?.password || 'Set your password from the secure invite link');
    sendDirectBrandMail(email, 'You are invited to join Yogi Desk AI Team', inviteHTML, 'system')
      .catch((err) => console.error('Brevo invite mail error:', err.message));

    return res.json({ msg: 'Member Added Successfully', member });
  } catch (err) {
    console.error('Add Error:', err.message || err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// --- 2. GET MEMBERS ---
exports.getTeamMembers = async (req, res) => {
  try {
    const db = getDb();
    const adminId = resolveAdminId(req);
    if (!db?.from) return res.status(500).json({ msg: 'Staff database service is unavailable.' });
    if (!adminId) return res.status(401).json({ msg: 'Authenticated doctor workspace is required.' });

    const { data, error } = await db
      .from(STAFF_MEMBERS_TABLE)
      .select('id, admin_id, name, email, role, status, is_active, invite_expires_at, accepted_at, deleted_at, created_at')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('List Error:', err.message || err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// --- 3. DELETE MEMBER (Secure Soft Delete) ---
exports.deleteTeamMember = async (req, res) => {
  try {
    const db = getDb();
    const adminId = resolveAdminId(req);
    const memberId = String(req.params.id || '').trim();
    if (!db?.from) return res.status(500).json({ msg: 'Staff database service is unavailable.' });
    if (!adminId) return res.status(401).json({ msg: 'Authenticated doctor workspace is required.' });
    if (!memberId) return res.status(400).json({ msg: 'Staff member ID is required.' });

    const now = new Date().toISOString();
    const { data: member, error } = await db
      .from(STAFF_MEMBERS_TABLE)
      .update({ is_active: false, status: 'DELETED', deleted_at: now })
      .eq('id', memberId)
      .eq('admin_id', adminId)
      .select('id, name, email, status, is_active, deleted_at')
      .maybeSingle();

    if (error) throw error;
    if (!member?.id) return res.status(404).json({ msg: 'Staff member not found.' });

    await stampClinicStaffDeletedAt(db, adminId, now);

    return res.json({
      msg: 'Staff member archived successfully.',
      id: memberId,
      member,
      lastStaffDeletedAt: now,
      cooldown: calculateCooldown(now)
    });
  } catch (err) {
    console.error('Delete Error:', err.message || err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};
