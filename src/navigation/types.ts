/**
 * Route params for the root stack.
 *
 * `AddEditPerson` doubles as create and edit: omit `contactId` to create.
 * `PersonDetail` always needs a contact — it's also the deep-link target when a
 * reminder notification is tapped (Step 6).
 */
export type RootStackParamList = {
  SignIn: undefined;
  PeopleList: undefined;
  AddEditPerson: { contactId?: string } | undefined;
  PersonDetail: { contactId: string };
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
