/**
 * Permission Handling
 * ===================
 * Centralized permission management for all required permissions.
 * Handles foreground/background location, notifications, and SMS (Android).
 */

import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SMS from 'expo-sms';
import { locationService } from '../services/locationService';

export interface PermissionStatus {
  location: {
    foreground: boolean;
    background: boolean;
  };
  notifications: boolean;
  sms: boolean;
}

/**
 * Request all required permissions in sequence.
 *
 * @returns Complete permission status
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  const locationPerms = await requestLocationPermissions();
  const notificationPerm = await requestNotificationPermission();
  const smsPerm = await checkSmsAvailability();

  const status: PermissionStatus = {
    location: locationPerms,
    notifications: notificationPerm,
    sms: smsPerm,
  };

  logPermissionStatus(status);
  return status;
}

/**
 * Request foreground + background location permissions.
 */
async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  return locationService.requestPermissions();
}

/**
 * Request notification permission (required for Android 13+).
 */
async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Permissions] Notification permission failed:', error);
    return false;
  }
}

/**
 * Check if SMS sending is available (Android only).
 */
async function checkSmsAvailability(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') return false;
    return await SMS.isAvailableAsync();
  } catch (error) {
    console.error('[Permissions] SMS availability check failed:', error);
    return false;
  }
}

/**
 * Show a dialog prompting the user to open Settings
 * when a critical permission is denied.
 */
export function promptOpenSettings(
  permissionName: string,
  reason: string,
): void {
  Alert.alert(
    `${permissionName} Permission Required`,
    `${reason}\n\nPlease enable it in your device settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings();
        },
      },
    ],
  );
}

/**
 * Check if all critical permissions are granted.
 */
export function hasRequiredPermissions(status: PermissionStatus): boolean {
  return status.location.foreground && status.notifications;
}

/**
 * Log permission status for debugging.
 */
function logPermissionStatus(status: PermissionStatus): void {
  console.log('[Permissions] Status:', {
    locationForeground: status.location.foreground,
    locationBackground: status.location.background,
    notifications: status.notifications,
    sms: status.sms,
  });
}
