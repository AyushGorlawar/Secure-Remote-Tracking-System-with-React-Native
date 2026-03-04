/**
 * Root Layout
 * ===========
 * Expo Router root layout. Initializes all services
 * and manages the app lifecycle.
 */

import { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  /** Run an async init step with a timeout so it never hangs forever. */
  const safeTry = async (
    label: string,
    fn: () => Promise<unknown>,
    timeoutMs = 5000,
  ) => {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs),
        ),
      ]);
    } catch (error) {
      console.warn(`[App] ${label} failed (non-fatal):`, error);
    }
  };

  const initializeApp = useCallback(async () => {
    try {
      console.log('[App] Initializing Secure Remote Tracking System...');

      // Skip native-only initialization on web
      if (Platform.OS === 'web') {
        console.log('[App] Web platform — skipping native service init');
        setIsReady(true);
        return;
      }

      // Dynamic imports so web bundle doesn't pull in native modules
      const { securityService } = await import('../src/services/securityService');
      const { triggerService } = await import('../src/services/triggerService');
      const { survivalMode } = await import('../src/services/survivalMode');
      const { registerBackgroundFetch, startBackgroundLocation } =
        await import('../src/config/backgroundTasks');
      const { requestAllPermissions, hasRequiredPermissions } =
        await import('../src/utils/permissions');

      // 1. Initialize security service (device ID, etc.)
      await safeTry('SecurityService', () => securityService.initialize());

      // 2. Request permissions (may prompt user dialogs)
      let permissions = {
        location: { foreground: false, background: false },
        notifications: false,
        sms: false,
      };
      await safeTry('Permissions', async () => {
        permissions = await requestAllPermissions();
        if (!hasRequiredPermissions(permissions)) {
          console.warn('[App] Not all required permissions granted');
        }
      });

      // 3. Initialize trigger service (push notifications)
      await safeTry('TriggerService', async () => {
        await triggerService.initialize();
        await triggerService.registerForPushNotifications();
      });

      // 4. Initialize survival mode (battery monitoring)
      await safeTry('SurvivalMode', () => survivalMode.initialize());

      // 4.5. Initialize SMS auto-reply listener (Android only)
      const { smsAutoReplyService } = await import('../src/services/smsAutoReplyService');
      await safeTry('SmsAutoReply', () => smsAutoReplyService.initialize());

      // 5. Register background tasks
      await safeTry('BackgroundFetch', () => registerBackgroundFetch());
      if (permissions.location.background) {
        await safeTry('BackgroundLocation', () => startBackgroundLocation());
      }

      // 6. Check for SIM change
      await safeTry('SIMDetection', () => securityService.detectSimChange());

      console.log('[App] Initialization complete');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('[App] Initialization failed:', error);
      setInitError(message);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0d1117' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0d1117' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1117',
  },
});
