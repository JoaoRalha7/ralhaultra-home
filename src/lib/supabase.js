import { createClient } from '@supabase/supabase-js';

// Public (anon) keys, same as the original project. Env vars override them if set.
const clean = (v) => (v ? String(v).trim().replace(/^["']|["']$/g, '') : '');
const env = import.meta.env;

const SUPABASE_URL = clean(env.VITE_SUPABASE_URL) || 'https://zyzjvbpveriwsxhpheoh.supabase.co';
const SUPABASE_ANON_KEY =
  clean(env.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emp2YnB2ZXJpd3N4aHBoZW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTA0NTcsImV4cCI6MjA4MzU2NjQ1N30.t3I_PgY2YllFVPe8jCzLkBI1CgiALDGHWcslRnVU0U8';
const SUPABASE_DASH_URL = clean(env.VITE_SUPABASE_DASH_URL) || 'https://vsqxaxaxdvvwrvjookbm.supabase.co';
const SUPABASE_DASH_KEY =
  clean(env.VITE_SUPABASE_DASH_KEY || env.VITE_SUPABASE_DASH_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzcXhheGF4ZHZ2d3J2am9va2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNjk2NTgsImV4cCI6MjA2ODk0NTY1OH0.Tv-ZvRqFVByq4TtFke31P0yn3gAf6F2h3ucVpzwLeug';

// Public instance: auth, profiles, casinos, shop
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
// Dashboard instance: slots, bonus hunts, mini-games
export const supabaseDash = createClient(SUPABASE_DASH_URL, SUPABASE_DASH_KEY);

export const isConfigured = true;
export const missingEnv = [];
