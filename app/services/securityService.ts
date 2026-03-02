/**
 * Security Service
 * ================
 * Handles payload validation, HMAC verification, timestamp checks,
 * SIM change detection, and device identity management.
 */

import * as SecureStore from 'expo-secure-store';
import * as Cellular from 'expo-cellular';
import * as Device from 'expo-device';
import { ENV } from '../config/environment';
import { verifyHMAC, generateDeviceId } from '../utils/encryption';
import { TriggerPayload, SimInfo, ServiceError } from '../types';

/**
 * SecurityService — singleton that manages device security concerns.
 */
class SecurityService {
  private deviceId: string | null = null;
  private lastSimInfo: SimInfo | null = null;

  /**
   * Initialize the security service.
   * Loads or creates device ID, loads last SIM info.
   */
  async initialize(): Promise<void> {
    try {
      this.deviceId = await this.getOrCreateDeviceId();
      console.log('[SecurityService] Initialized with deviceId:', this.deviceId);
    } catch (error) {
      console.warn('[SecurityService] DeviceId init failed, using fallback:', error);
      this.deviceId = `SRTS-FALLBACK-${Date.now()}`;
    }

    try {
      this.lastSimInfo = await this.loadLastSimInfo();
    } catch (error) {
      console.warn('[SecurityService] SIM info load failed (non-fatal):', error);
    }
  }

  /**
   * Get the current device ID.
   */
  getDeviceId(): string {
    if (!this.deviceId) {
      console.warn('[SecurityService] Not initialized, returning fallback ID');
      return `SRTS-UNINITIALIZED-${Date.now()}`;
    }
    return this.deviceId;
  }

  /**
   * Validate an incoming trigger payload.
   *
   * Steps:
   * 1. Check timestamp freshness (must be within 60s)
   * 2. Verify HMAC signature
   * 3. Check device ID matches
   *
   * @param payload - The trigger payload to validate
   * @returns True if the payload is valid
   */
  async validatePayload(payload: TriggerPayload): Promise<boolean> {
    try {
      // 1. Timestamp freshness check
      const now = Date.now();
      const age = Math.abs(now - payload.timestamp);

      if (age > ENV.PAYLOAD_MAX_AGE_MS) {
        console.warn(
          `[SecurityService] Payload rejected: timestamp too old (${age}ms > ${ENV.PAYLOAD_MAX_AGE_MS}ms)`,
        );
        return false;
      }

      // 2. HMAC verification
      const hmacValid = await verifyHMAC(
        payload.deviceId,
        payload.timestamp,
        payload.hmac,
      );

      if (!hmacValid) {
        console.warn('[SecurityService] Payload rejected: invalid HMAC');
        return false;
      }

      // 3. Device ID check
      if (payload.deviceId !== this.deviceId) {
        console.warn(
          '[SecurityService] Payload rejected: device ID mismatch',
        );
        return false;
      }

      console.log('[SecurityService] Payload validated successfully');
      return true;
    } catch (error) {
      console.error('[SecurityService] Payload validation error:', error);
      return false;
    }
  }

  /**
   * Detect if the SIM card has changed since the last check.
   *
   * This is a placeholder implementation that compares carrier info.
   * For full production use, integrate with native TelephonyManager APIs.
   */
  async detectSimChange(): Promise<boolean> {
    try {
      const currentSim = await this.getCurrentSimInfo();

      if (!this.lastSimInfo) {
        // First run — store current SIM info
        await this.saveSimInfo(currentSim);
        this.lastSimInfo = currentSim;
        return false;
      }

      const changed =
        currentSim.carrier !== this.lastSimInfo.carrier ||
        currentSim.mobileCountryCode !== this.lastSimInfo.mobileCountryCode ||
        currentSim.mobileNetworkCode !== this.lastSimInfo.mobileNetworkCode;

      if (changed) {
        console.warn('[SecurityService] SIM change detected!');
        await this.saveSimInfo(currentSim);
        this.lastSimInfo = currentSim;
      }

      return changed;
    } catch (error) {
      console.warn('[SecurityService] SIM detection failed (expected on iOS/emulator):', error);
      return false;
    }
  }

  /**
   * Get device metadata for reports.
   */
  getDeviceInfo(): Record<string, unknown> {
    return {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      deviceType: Device.deviceType,
    };
  }

  // ─── Private Methods ─────────────────────────────────────────────

  private async getOrCreateDeviceId(): Promise<string> {
    const stored = await SecureStore.getItemAsync(
      ENV.SECURE_STORE_KEYS.DEVICE_ID,
    );

    if (stored) return stored;

    const newId = await generateDeviceId();
    await SecureStore.setItemAsync(ENV.SECURE_STORE_KEYS.DEVICE_ID, newId);
    return newId;
  }

  private async getCurrentSimInfo(): Promise<SimInfo> {
    const carrier = await Cellular.getCarrierNameAsync();
    const isoCountryCode = await Cellular.getIsoCountryCodeAsync();
    const mobileCountryCode = await Cellular.getMobileCountryCodeAsync();
    const mobileNetworkCode = await Cellular.getMobileNetworkCodeAsync();

    return {
      carrier,
      isoCountryCode,
      mobileCountryCode,
      mobileNetworkCode,
    };
  }

  private async loadLastSimInfo(): Promise<SimInfo | null> {
    try {
      const stored = await SecureStore.getItemAsync(
        ENV.SECURE_STORE_KEYS.LAST_SIM_INFO,
      );
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private async saveSimInfo(info: SimInfo): Promise<void> {
    await SecureStore.setItemAsync(
      ENV.SECURE_STORE_KEYS.LAST_SIM_INFO,
      JSON.stringify(info),
    );
  }
}

/** Singleton instance */
export const securityService = new SecurityService();
