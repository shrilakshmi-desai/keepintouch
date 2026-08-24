/**
 * Native no-op. Mobile uses on-device local notifications; the browser
 * implementation lives in the .web.ts sibling.
 */
export type WebPushState = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed';

export const WEB_PUSH_PLATFORM = false;

export async function getWebPushState(): Promise<WebPushState> {
  return 'unsupported';
}

export async function subscribeToWebPush(): Promise<WebPushState> {
  return 'unsupported';
}

export async function unsubscribeFromWebPush(): Promise<void> {}

/** iOS delivers push only to a PWA launched from the home screen. */
export function needsHomeScreenInstall(): boolean {
  return false;
}
