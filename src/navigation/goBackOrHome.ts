type Navigator = {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate: (screen: 'PeopleList') => void;
};

/**
 * Leaves the current screen, even when there's nothing beneath it.
 *
 * A screen reached by deep link can be the only entry on the stack, where
 * goBack() is a no-op — so a delete would succeed while the screen stayed put,
 * looking broken. Falling back to the list makes the outcome the same either way.
 */
export function goBackOrHome(navigation: Navigator): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate('PeopleList');
}
