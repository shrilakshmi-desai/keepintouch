import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from './types';

/**
 * Web URL routing, so a pushed reminder opening /person/<id> lands on that
 * person rather than the list.
 *
 * Applied on web only. On native the auth redirect arrives as a deep link
 * (exp://…/--/auth-callback) which AuthProvider redeems itself; handing those
 * URLs to the navigator as well risks it swallowing or mis-routing them.
 */
export const webLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/')],
  config: {
    /**
     * Without this, opening /person/<id> from a notification makes PersonDetail
     * the only screen on the stack: no back button, and goBack() silently does
     * nothing. Naming the initial route rebuilds the list underneath it, so a
     * deep-linked screen behaves exactly like one reached by tapping through.
     */
    initialRouteName: 'PeopleList',
    screens: {
      SignIn: 'signin',
      PeopleList: '',
      AddEditPerson: 'edit',
      PersonDetail: 'person/:contactId',
      Settings: 'settings',
    },
  },
};
