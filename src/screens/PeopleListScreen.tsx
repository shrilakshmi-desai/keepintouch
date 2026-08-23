import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../components/Button';
import Placeholder from '../components/Placeholder';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleList'>;

export default function PeopleListScreen({ navigation }: Props) {
  return (
    <Placeholder
      title="Your people"
      description="Everyone you're keeping up with, soonest-due first, with a badge on anyone overdue."
      step="Step 3 — the list lands here"
    >
      <Button label="Add a person" onPress={() => navigation.navigate('AddEditPerson')} />
      <Button
        label="Open a person (sample)"
        variant="secondary"
        onPress={() => navigation.navigate('PersonDetail', { contactId: 'sample' })}
      />
      <Button label="Settings" variant="secondary" onPress={() => navigation.navigate('Settings')} />
    </Placeholder>
  );
}
