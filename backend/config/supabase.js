const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL CONFIGURATION ERROR: Supabase environment credentials evaluating to undefined.");
}

const createSupabaseClient = (key) => (
  supabaseUrl && key
    ? createClient(supabaseUrl, key)
    : null
);

const supabase = createSupabaseClient(supabaseAnonKey);
// Use service role for administrative tasks (like updating profiles without auth constraints)
const supabaseAdmin = createSupabaseClient(supabaseServiceKey) || supabase;

module.exports = { supabase, supabaseAdmin };
