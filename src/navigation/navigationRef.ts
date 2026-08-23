import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Lets non-React code (the notification tap handler) drive navigation without
 * threading a navigation prop through the app.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
