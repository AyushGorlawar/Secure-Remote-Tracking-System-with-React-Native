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
import { PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import { locationService } from '../services/locationService';

/** Check if running inside Expo Go */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

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

  // Request SMS receive permission for auto-reply (Android only)
  if (Platform.OS === 'android') {
    await requestSmsReceivePermission();
  }

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
    if (isExpoGo()) {
      console.log('[Permissions] Expo Go — skipping push notification permission');
      return false;
    }

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
 * Request RECEIVE_SMS and READ_SMS permissions for auto-reply.
 * These are needed so the BroadcastReceiver can intercept incoming SMS.
 */
async function requestSmsReceivePermission(): Promise<boolean> {
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
    ]);

    const allGranted =
      granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.SEND_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

    console.log('[Permissions] SMS receive permissions:', allGranted ? 'granted' : 'denied');
    return allGranted;
  } catch (error) {
    console.error('[Permissions] SMS receive permission request failed:', error);
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
