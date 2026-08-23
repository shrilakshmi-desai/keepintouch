import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';

// Dismisses the auth browser if it's still open when we come back.
WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  /** True until the persisted session has been read back from AsyncStorage. */
  initializing: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Pulls auth params out of the redirect URL.
 *
 * Written by hand rather than with `new URL()` because the Expo Go redirect uses
 * a non-standard scheme (`exp://10.0.0.4:8081/--/auth-callback?code=…`) that URL
 * parsers handle inconsistently. PKCE returns `code` in the query string;
 * the implicit flow returns tokens in the fragment, so we read both.
 */
function extractAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  const collect = (segment: string) => {
    for (const pair of segment.split('&')) {
      if (!pair) continue;
      const [rawKey, ...rest] = pair.split('=');
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('='));
    }
  };

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hasQuery = queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex);

  if (hasQuery) {
    collect(url.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex));
  }
  if (hashIndex !== -1) {
    collect(url.slice(hashIndex + 1));
  }

  return params;
}

/** The token or code that identifies a redirect, so we never redeem one twice. */
function redemptionKey(params: Record<string, string>): string | null {
  return params.code ?? params.access_token ?? null;
}

async function createSessionFromUrl(url: string): Promise<void> {
  const params = extractAuthParams(url);

  if (params.error_description || params.error) {
    throw new Error(params.error_description ?? params.error);
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return;
  }

  throw new Error('Sign-in redirect carried no session. Check the Supabase redirect URL settings.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  /** Codes already redeemed — the browser result and the deep link can both deliver the same one. */
  const redeemed = useRef<Set<string>>(new Set());

  /**
   * Redeems a redirect URL exactly once. Returns false when the URL carries no
   * auth payload at all (an ordinary deep link, so not our business).
   */
  async function consumeRedirect(url: string): Promise<boolean> {
    const params = extractAuthParams(url);
    const key = redemptionKey(params);

    if (!key) {
      if (params.error || params.error_description) {
        throw new Error(params.error_description ?? params.error);
      }
      return false;
    }
    if (redeemed.current.has(key)) return true;
    redeemed.current.add(key);

    await createSessionFromUrl(url);
    return true;
  }

  // Fallback path: if the auth browser hands off to the OS instead of resolving
  // in-place, the redirect arrives here as a deep link.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      consumeRedirect(url).catch((e) => {
        console.warn('[auth] deep link could not be redeemed:', e);
      });
    };

    Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      async signInWithGoogle() {
        // In Expo Go this resolves to exp://<lan-ip>:<port>/--/auth-callback.
        // This exact string must be in Supabase's redirect allow-list, or Supabase
        // silently falls back to the project's Site URL and the redirect dies in
        // the browser. If the LAN address ever changes, the failure path below
        // reports the new URL to allow-list.
        const redirectTo = Linking.createURL('auth-callback');

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data.url) throw new Error('Supabase did not return a sign-in URL.');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (result.type === 'success') {
          await consumeRedirect(result.url);
          return;
        }

        // The browser closed without ever reaching redirectTo. Either the user
        // backed out, or Supabase redirected somewhere we don't recognise — most
        // often the Site URL, which shows up as a connection error in the browser.
        if (result.type === 'cancel' || result.type === 'dismiss') {
          if (!redeemed.current.size) {
            throw new Error(
              `Sign-in closed before returning to the app. If the browser showed a connection ` +
                `error, add this exact URL to Supabase → Authentication → URL Configuration → ` +
                `Redirect URLs:\n\n${redirectTo}`,
            );
          }
          return;
        }

        throw new Error(`Sign-in did not complete (${result.type}).`);
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
