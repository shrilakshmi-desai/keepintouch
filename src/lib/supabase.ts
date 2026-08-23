import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from './database.types';

const isWeb = Platform.OS === 'web';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill both in, then restart the dev server.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // On web the OAuth redirect lands back in the address bar and supabase-js
    // reads the session from it. On native there is no URL bar, so we hand the
    // redirect to Supabase ourselves in signInWithGoogle().
    detectSessionInUrl: isWeb,
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is in the foreground — a timer firing in the
// background is wasted work and can race with the OS suspending us. supabase-js
// already handles this itself in a browser, so this is native-only.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
