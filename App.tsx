import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthProvider';
import NotificationBridge from './src/components/NotificationBridge';
import { webLinking } from './src/navigation/linking';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import { registerServiceWorker } from './src/pwa/registerServiceWorker';
import { usePushRouting } from './src/pwa/usePushRouting';

registerServiceWorker();

export default function App() {
  usePushRouting();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={Platform.OS === 'web' ? webLinking : undefined}
        >
          <StatusBar style="dark" />
          <NotificationBridge />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
