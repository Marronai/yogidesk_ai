const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL CONFIGURATION ERROR: Supabase Service Role credentials evaluating to undefined.");
}

const createSupabaseClient = (key) => (
  supabaseUrl && key
    ? createClient(supabaseUrl, key)
    : null
);

// Enforce Service Role Key for backend environment to bypass RLS filters
const supabase = createSupabaseClient(supabaseServiceKey);
const supabaseAdmin = supabase;

module.exports = { supabase, supabaseAdmin };
