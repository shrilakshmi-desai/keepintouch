import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import AddEditPersonScreen from '../screens/AddEditPersonScreen';
import PeopleListScreen from '../screens/PeopleListScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/SignInScreen';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth gate: the app screens aren't merely hidden when signed out, they're not
 * registered at all — so there's no route a stray navigate() could reach.
 */
export default function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {session ? (
        <>
          <Stack.Screen
            name="PeopleList"
            component={PeopleListScreen}
            options={{ title: 'People' }}
          />
          <Stack.Screen
            name="AddEditPerson"
            component={AddEditPersonScreen}
            options={{ title: 'Add person' }}
          />
          <Stack.Screen
            name="PersonDetail"
            component={PersonDetailScreen}
            options={{ title: 'Detail' }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </>
      ) : (
        <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
