import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Placeholder from '../components/Placeholder';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditPerson'>;

export default function AddEditPersonScreen({ route }: Props) {
  const isEditing = Boolean(route.params?.contactId);

  return (
    <Placeholder
      title={isEditing ? 'Edit person' : 'Add a person'}
      description="Name, type, optional phone and email, an import-from-contacts button, a schedule picker, and talking points."
      step="Steps 3–5 — form, contact import, schedule picker"
    />
  );
}
