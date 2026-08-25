export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

function joined(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

/**
 * Browser dialogs, via the built-in modals.
 *
 * window.confirm can't take custom button labels, so the action is spelled out
 * in the text instead — "Delete Ana?" reads clearly against an OK/Cancel pair.
 * Both calls are synchronous and blocking; the promises exist to match the
 * native signature.
 */
export async function notify(title: string, message?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.alert(joined(title, message));
}

export async function confirm({ title, message }: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return window.confirm(joined(title, message));
}
