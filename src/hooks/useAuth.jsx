import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [session, isSettingUp]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isSettingUp,
      setIsSettingUp,
      isAdmin: Boolean(profile?.is_admin || profile?.role === 'admin'), // TODO: match the original useAuth
      signInWithTwitch: () =>
        supabase.auth.signInWithOAuth({ provider: 'twitch', options: { redirectTo: `${window.location.origin}/auth/callback` } }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, profile, loading, isSettingUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
