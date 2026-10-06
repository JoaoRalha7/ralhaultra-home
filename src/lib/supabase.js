import { createClient } from '@supabase/supabase-js';

// Trim spaces and surrounding quotes so a sloppy .env still works.
const clean = (v) => (v ? String(v).trim().replace(/^["']|["']$/g, '') : '');

const url = clean(import.meta.env.VITE_SUPABASE_URL);
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
const dashUrl = clean(import.meta.env.VITE_SUPABASE_DASH_URL);
const dashKey = clean(import.meta.env.VITE_SUPABASE_DASH_KEY || import.meta.env.VITE_SUPABASE_DASH_ANON_KEY);

export const isConfigured = Boolean(url && key && dashUrl && dashKey);

export const missingEnv = [
  ['VITE_SUPABASE_URL', url],
  ['VITE_SUPABASE_ANON_KEY', key],
  ['VITE_SUPABASE_DASH_URL', dashUrl],
  ['VITE_SUPABASE_DASH_KEY', dashKey],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingEnv.length) {
  console.warn('[RalhaUltra] Missing env vars (create .env and restart `npm run dev`):', missingEnv.join(', '));
}

// Placeholders keep the pages from crashing when .env is missing (requests just fail).
const make = (u, k) => {
  try {
    return createClient(u || 'http://localhost:54321', k || 'missing-anon-key');
  } catch (e) {
    console.error('[RalhaUltra] Invalid Supabase URL/key:', u, e);
    return createClient('http://localhost:54321', 'missing-anon-key');
  }
};

// Public instance: auth, profiles, casinos, shop
export const supabase = make(url, key);
// Dashboard instance: slots, bonus hunts, mini-games
export const supabaseDash = make(dashUrl, dashKey);
