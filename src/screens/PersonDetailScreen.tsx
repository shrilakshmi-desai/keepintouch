import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Placeholder from '../components/Placeholder';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonDetail'>;

export default function PersonDetailScreen({ route }: Props) {
  const { contactId } = route.params;

  return (
    <Placeholder
      title="Person detail"
      description={`Their info, talking points, next reminder, and the "Reached out" button. Tapping a reminder notification opens this screen.\n\ncontactId: ${contactId}`}
      step="Steps 3 & 7 — detail view and the Reached out loop"
    />
  );
}
