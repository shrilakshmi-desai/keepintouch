import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Native dialogs. The browser implementation is in the .web.ts sibling —
 * react-native-web's Alert is literally `static alert() {}`, so anything routed
 * through it on web silently does nothing.
 *
 * Both return promises so callers can await dismissal rather than passing
 * callbacks into a platform-specific button array.
 */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Dismissing by tapping outside must resolve too, or the caller hangs.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
