const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_CLOCK_SKEW_RETRY_MS = Number(process.env.SUPABASE_JWT_CLOCK_SKEW_RETRY_MS || 1200);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL CONFIGURATION ERROR: Supabase Service Role credentials evaluating to undefined.");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isFutureJwtResponse = (bodyText) => {
  const text = String(bodyText || '').toLowerCase();
  return text.includes('pgrst303') || (text.includes('jwt') && text.includes('future'));
};

const createClockSkewRetryFetch = () => {
  if (typeof fetch !== 'function') return undefined;
  const baseFetch = fetch.bind(globalThis);

  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (![400, 401].includes(response.status)) return response;

    let bodyText = '';
    try {
      bodyText = await response.clone().text();
    } catch (error) {
      return response;
    }

    if (!isFutureJwtResponse(bodyText)) return response;
    console.warn('[YogiDesk Supabase] Retrying request after JWT clock drift response (PGRST303).');
    await delay(SUPABASE_JWT_CLOCK_SKEW_RETRY_MS);
    return baseFetch(input, init);
  };
};

const createSupabaseClient = (key) => {
  const skewRetryFetch = createClockSkewRetryFetch();
  return supabaseUrl && key
    ? createClient(supabaseUrl, key, {
      auth: { persistSession: false },
      realtime: { transport: ws },
      ...(skewRetryFetch ? { global: { fetch: skewRetryFetch } } : {})
    })
    : null;
};

// Enforce Service Role Key for backend environment to bypass RLS filters
const supabase = createSupabaseClient(supabaseServiceKey);
const supabaseAdmin = supabase;

module.exports = { supabase, supabaseAdmin };
