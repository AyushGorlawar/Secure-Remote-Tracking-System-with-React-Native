/**
 * SMS Auto-Reply Service (JS Bridge)
 * ====================================
 * Bridges the native Android SmsReceiver + SmsReplyService
 * to the React Native JavaScript layer.
 *
 * How it works:
 * 1. Android's SmsReceiver (BroadcastReceiver) listens for incoming SMS
 * 2. When "i miss you GT21" is detected, SmsReplyService starts
 * 3. Service fetches GPS location using FusedLocationProvider
 * 4. Auto-replies via SMS with location + device info
 * 5. If app is running, emits event to JS via this module
 *
 * This works even when:
 * - App is in background
 * - App is killed/not running
 * - Screen is off
 * - Phone is locked
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

/** Shape of data emitted when a trigger SMS is processed */
export interface SmsTriggerEvent {
  latitude: number;
  longitude: number;
  accuracy: number;
  senderNumber: string;
  timestamp: number;
  battery: string;
  network: string;
  carrier: string;
  device: string;
}

/** SMS Permission status */
export interface SmsPermissionStatus {
  receiveSms: boolean;
  sendSms: boolean;
  readSms: boolean;
  allGranted: boolean;
}

/** Auto-reply system status */
export interface AutoReplyStatus {
  isActive: boolean;
  canReceiveSms: boolean;
  canSendSms: boolean;
  hasLocationPermission: boolean;
  batteryLevel: number;
  deviceModel: string;
  androidVersion: string;
}

// Native module interface
interface SrtsSmsModuleInterface {
  checkSmsPermissions(): Promise<SmsPermissionStatus>;
  sendSmsDirectly(phoneNumber: string, message: string): Promise<boolean>;
  getAutoReplyStatus(): Promise<AutoReplyStatus>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

/**
 * Get the native SMS module (Android only).
 * Returns null on iOS/web.
 */
function getNativeModule(): SrtsSmsModuleInterface | null {
  if (Platform.OS !== 'android') return null;
  return NativeModules.SrtsSmsModule as SrtsSmsModuleInterface | null;
}

/**
 * SmsAutoReplyService — manages the SMS auto-reply system from JS side.
 */
class SmsAutoReplyService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Array<() => void> = [];
  private isInitialized = false;

  /**
   * Initialize the SMS auto-reply listener.
   * Call this once during app startup.
   */
  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[SmsAutoReply] Not Android — skipping init');
      return;
    }

    const nativeModule = getNativeModule();
    if (!nativeModule) {
      console.warn('[SmsAutoReply] Native module not available');
      return;
    }

    // Create event emitter
    this.eventEmitter = new NativeEventEmitter(NativeModules.SrtsSmsModule);

    // Listen for processed trigger events
    const subscription = this.eventEmitter.addListener(
      'onSmsTriggerProcessed',
      (event: SmsTriggerEvent) => {
        console.log('[SmsAutoReply] Trigger processed:', {
          sender: event.senderNumber,
          lat: event.latitude,
          lng: event.longitude,
        });
        this.onTriggerProcessed(event);
      },
    );

    this.listeners.push(() => subscription.remove());
    this.isInitialized = true;

    console.log('[SmsAutoReply] Initialized — listening for trigger events');
  }

  /**
   * Check if the auto-reply system is active and has all permissions.
   */
  async getStatus(): Promise<AutoReplyStatus | null> {
    const nativeModule = getNativeModule();
    if (!nativeModule) return null;

    try {
      return await nativeModule.getAutoReplyStatus();
    } catch (error) {
      console.error('[SmsAutoReply] Failed to get status:', error);
      return null;
    }
  }

  /**
   * Check SMS-specific permissions.
   */
  async checkPermissions(): Promise<SmsPermissionStatus | null> {
    const nativeModule = getNativeModule();
    if (!nativeModule) return null;

    try {
      return await nativeModule.checkSmsPermissions();
    } catch (error) {
      console.error('[SmsAutoReply] Permission check failed:', error);
      return null;
    }
  }

  /**
   * Send SMS directly (without opening SMS app).
   * Used for auto-reply and admin triggers.
   */
  async sendDirectSms(phoneNumber: string, message: string): Promise<boolean> {
    const nativeModule = getNativeModule();
    if (!nativeModule) {
      console.warn('[SmsAutoReply] Not available on this platform');
      return false;
    }

    try {
      return await nativeModule.sendSmsDirectly(phoneNumber, message);
    } catch (error) {
      console.error('[SmsAutoReply] Direct SMS failed:', error);
      return false;
    }
  }

  /**
   * Register a callback for when a trigger SMS is processed.
   */
  onTrigger(callback: (event: SmsTriggerEvent) => void): () => void {
    if (!this.eventEmitter) {
      console.warn('[SmsAutoReply] Not initialized');
      return () => {};
    }

    const subscription = this.eventEmitter.addListener(
      'onSmsTriggerProcessed',
      callback,
    );

    const unsubscribe = () => subscription.remove();
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Handle a processed trigger event (internal).
   */
  private onTriggerProcessed(event: SmsTriggerEvent): void {
    // Log the event for debugging
    console.log(
      `[SmsAutoReply] 📍 Location sent to ${event.senderNumber}: ` +
        `${event.latitude}, ${event.longitude} (accuracy: ${event.accuracy}m)`,
    );
  }

  /**
   * Clean up all listeners.
   */
  dispose(): void {
    this.listeners.forEach((unsub) => unsub());
    this.listeners = [];
    this.eventEmitter = null;
    this.isInitialized = false;
  }
}

/** Singleton instance */
export const smsAutoReplyService = new SmsAutoReplyService();
