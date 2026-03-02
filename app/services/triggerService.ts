/**
 * Trigger Service
 * ===============
 * Processes incoming push triggers (FCM silent pushes).
 * Orchestrates the full trigger → validate → locate → report pipeline.
 */

import * as Notifications from 'expo-notifications';
import { ENV } from '../config/environment';
import { TriggerPayload, TriggerResult, ServiceError } from '../types';
import { securityService } from './securityService';
import { locationService } from './locationService';
import { decisionEngine } from './decisionEngine';
import { survivalMode } from './survivalMode';

/**
 * TriggerService — handles the complete lifecycle of a tracking trigger.
 */
class TriggerService {
  private isProcessing = false;

  /**
   * Initialize FCM / Expo Notifications for silent push handling.
   */
  async initialize(): Promise<void> {
    // Configure notification handler for silent/background pushes
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.MIN,
      }),
    });

    // Listen for incoming notifications (foreground)
    Notifications.addNotificationReceivedListener((notification) => {
      this.handleIncomingNotification(notification);
    });

    // Listen for background notification responses
    Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleIncomingNotification(response.notification);
    });

    console.log('[TriggerService] Initialized');
  }

  /**
   * Register for push notifications and get the Expo push token.
   *
   * @returns Expo push token string, or null if registration fails
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn(
          '[TriggerService] Push notification permission not granted',
        );
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Will use Constants.expoConfig.extra.eas.projectId
      });

      console.log('[TriggerService] Push token:', tokenData.data);
      return tokenData.data;
    } catch (error) {
      console.error(
        '[TriggerService] Push registration failed:',
        error,
      );
      return null;
    }
  }

  /**
   * Process an incoming notification and extract the trigger payload.
   */
  private async handleIncomingNotification(
    notification: Notifications.Notification,
  ): Promise<void> {
    try {
      const data = notification.request.content.data as
        | Partial<TriggerPayload>
        | undefined;

      if (!data?.deviceId || !data?.timestamp || !data?.hmac) {
        console.warn(
          '[TriggerService] Notification missing required trigger fields',
        );
        return;
      }

      const payload: TriggerPayload = {
        deviceId: data.deviceId,
        timestamp: Number(data.timestamp),
        hmac: data.hmac,
        command: (data.command as TriggerPayload['command']) ?? 'LOCATE',
      };

      await this.processTrigger(payload);
    } catch (error) {
      console.error(
        '[TriggerService] Error handling notification:',
        error,
      );
    }
  }

  /**
   * Process a trigger payload through the full pipeline.
   *
   * Pipeline:
   * 1. Validate payload (HMAC + timestamp)
   * 2. Check battery → emergency mode if critical
   * 3. Fetch GPS location
   * 4. Decision engine: HTTPS or SMS
   *
   * @param payload - The validated trigger payload
   * @returns TriggerResult describing the outcome
   */
  async processTrigger(payload: TriggerPayload): Promise<TriggerResult> {
    if (this.isProcessing) {
      console.warn('[TriggerService] Already processing a trigger, skipping');
      return {
        success: false,
        method: 'NONE',
        error: 'Already processing',
        timestamp: Date.now(),
      };
    }

    this.isProcessing = true;

    try {
      // Step 1: Validate payload
      const isValid = await securityService.validatePayload(payload);
      if (!isValid) {
        return {
          success: false,
          method: 'NONE',
          error: 'Invalid payload',
          timestamp: Date.now(),
        };
      }

      // Step 2: Check battery and trigger survival mode if needed
      const batteryCheck = await survivalMode.checkBattery();
      if (batteryCheck.isLowPower) {
        console.warn(
          '[TriggerService] Low battery detected, triggering emergency ping',
        );
        return await survivalMode.emergencyLocationPing();
      }

      // Step 3: Handle the command
      const command = payload.command ?? 'LOCATE';

      switch (command) {
        case 'LOCATE':
        case 'PING':
          return await this.executeLocateCommand();
        case 'EMERGENCY':
          return await survivalMode.emergencyLocationPing();
        default:
          return {
            success: false,
            method: 'NONE',
            error: `Unknown command: ${command}`,
            timestamp: Date.now(),
          };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[TriggerService] Trigger processing failed:', error);

      return {
        success: false,
        method: 'NONE',
        error: message,
        timestamp: Date.now(),
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a standard LOCATE command.
   */
  private async executeLocateCommand(): Promise<TriggerResult> {
    // Get location
    const location = await locationService.getCurrentLocation();

    // Decide delivery method and send
    const result = await decisionEngine.processAndDeliver(location);

    return result;
  }

  /**
   * Manually trigger a location report (for testing/debug).
   */
  async manualTrigger(): Promise<TriggerResult> {
    const deviceId = securityService.getDeviceId();
    const timestamp = Date.now();

    // Create a self-signed payload for manual triggers
    const { generateHMAC } = await import('../utils/encryption');
    const hmac = await generateHMAC(deviceId, timestamp);

    const payload: TriggerPayload = {
      deviceId,
      timestamp,
      hmac,
      command: 'LOCATE',
    };

    return this.processTrigger(payload);
  }
}

/** Singleton instance */
export const triggerService = new TriggerService();
