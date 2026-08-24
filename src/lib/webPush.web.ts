import { supabase } from './supabase';

export type WebPushState = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export const WEB_PUSH_PLATFORM = true;

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/**
 * The subscribe API wants the raw 65-byte key, not the base64url string.
 *
 * Returns an ArrayBuffer rather than a Uint8Array: a typed array's backing
 * buffer is ArrayBufferLike, which doesn't satisfy BufferSource under current
 * lib types.
 */
function decodeVapidKey(base64Url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);

  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

function pushApiAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * True on an iPhone browsing in Safari rather than from the home screen.
 *
 * iOS exposes no Push API at all in that context, so "unsupported" there means
 * "install it first", not "your browser can't do this" — a distinction worth
 * making, because the user can act on one and not the other.
 */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === 'undefined') return false;

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as a Mac; the touch point count gives it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  return isIOS && !standalone && !pushApiAvailable();
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!pushApiAvailable()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const registration = await navigator.serviceWorker.getRegistration();
  const existing = await registration?.pushManager.getSubscription();
  return existing ? 'subscribed' : 'unsubscribed';
}

export async function subscribeToWebPush(): Promise<WebPushState> {
  if (!pushApiAvailable()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_VAPID_PUBLIC_KEY. Add it to .env and to the Vercel environment, then redeploy.',
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';

  // Waits for the worker registered at startup to reach "active"; subscribing
  // against an installing worker throws.
  const registration = await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Required by every browser: a push must always be user-visible.
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(VAPID_PUBLIC_KEY),
    }));

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You are signed out. Sign in again to turn on reminders.');

  const json = subscription.toJSON() as Record<string, unknown>;

  // Upsert on endpoint: re-subscribing on the same device must update the row,
  // not accumulate dead endpoints the sender would then fail against.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userData.user.id,
      endpoint: subscription.endpoint,
      subscription: json,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;

  return 'subscribed';
}

export async function unsubscribeFromWebPush(): Promise<void> {
  if (!pushApiAvailable()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  // Drop the row too, or the sender keeps pushing to a dead endpoint.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}
