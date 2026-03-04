/**
 * Decision Engine
 * ===============
 * Determines the best delivery method for location data
 * based on network availability, and executes the delivery.
 *
 * Decision Matrix:
 * - Internet available → Encrypted HTTPS POST
 * - Internet unavailable → SMS with Google Maps link
 * - Both fail → Store locally for later transmission
 */

import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import { LocationData, LocationReport, TriggerResult, ServiceError } from '../types';
import { hasInternetConnection, securePost } from '../utils/network';
import { encryptPayload } from '../utils/encryption';
import { securityService } from './securityService';
import { locationService } from './locationService';
import { survivalMode } from './survivalMode';
import { smsAutoReplyService } from './smsAutoReplyService';

/**
 * DecisionEngine — determines and executes the optimal delivery method.
 */
class DecisionEngine {
  /**
   * Process location data and deliver using the best available method.
   *
   * @param location - GPS location data to deliver
   * @returns TriggerResult describing the outcome
   */
  async processAndDeliver(location: LocationData): Promise<TriggerResult> {
    try {
      // Check internet availability
      const hasInternet = await hasInternetConnection();

      if (hasInternet) {
        return await this.deliverViaHTTPS(location);
      }

      // Fallback to SMS
      return await this.deliverViaSMS(location);
    } catch (error) {
      console.error('[DecisionEngine] Delivery failed:', error);

      // Last resort: store locally
      return await this.storeLocally(location);
    }
  }

  /**
   * Send location via encrypted HTTPS POST.
   */
  private async deliverViaHTTPS(
    location: LocationData,
  ): Promise<TriggerResult> {
    try {
      const batteryStatus = await survivalMode.checkBattery();

      const report: LocationReport = {
        deviceId: securityService.getDeviceId(),
        location,
        batteryLevel: batteryStatus.level,
        isCharging: batteryStatus.isCharging,
        networkType: 'wifi', // Will be enriched by actual NetInfo
        timestamp: Date.now(),
      };

      // Encrypt the payload
      const encrypted = await encryptPayload(
        report as unknown as Record<string, unknown>,
      );
      report.encryptedPayload = encrypted;

      // Send to backend
      await securePost(ENV.LOCATION_ENDPOINT, {
        encryptedPayload: encrypted,
        deviceId: report.deviceId,
        timestamp: report.timestamp,
      });

      console.log('[DecisionEngine] Location delivered via HTTPS');

      return {
        success: true,
        method: 'HTTPS',
        location,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[DecisionEngine] HTTPS delivery failed:', error);

      // Try SMS fallback
      return await this.deliverViaSMS(location);
    }
  }

  /**
   * Send location via SMS directly (without opening SMS app).
   * Uses native SrtsSmsModule for automatic, silent sending.
   */
  private async deliverViaSMS(
    location: LocationData,
  ): Promise<TriggerResult> {
    try {
      const mapsLink = locationService.generateMapsLink(
        location.latitude,
        location.longitude,
      );

      const batteryStatus = await survivalMode.checkBattery();
      const message = [
        `[SRTS Emergency Location]`,
        `Location: ${mapsLink}`,
        `Lat: ${location.latitude}`,
        `Lng: ${location.longitude}`,
        `Accuracy: ${location.accuracy?.toFixed(1)}m`,
        `Battery: ${(batteryStatus.level * 100).toFixed(0)}%`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n');

      // Use native direct SMS (sends automatically, no UI)
      const sent = await smsAutoReplyService.sendDirectSms(
        ENV.EMERGENCY_SMS_NUMBER,
        message,
      );

      if (sent) {
        console.log('[DecisionEngine] Location delivered via SMS (direct)');
        return {
          success: true,
          method: 'SMS',
          location,
          timestamp: Date.now(),
        };
      }

      console.warn('[DecisionEngine] Direct SMS failed, storing locally');
      return await this.storeLocally(location);
    } catch (error) {
      console.error('[DecisionEngine] SMS delivery failed:', error);
      return await this.storeLocally(location);
    }
  }

  /**
   * Store location locally as a last resort.
   * Can be transmitted later when connectivity is restored.
   */
  private async storeLocally(
    location: LocationData,
  ): Promise<TriggerResult> {
    try {
      // Location is already saved by locationService.getCurrentLocation()
      console.log('[DecisionEngine] Location stored locally');

      return {
        success: true,
        method: 'STORED',
        location,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[DecisionEngine] Local storage failed:', error);
      return {
        success: false,
        method: 'NONE',
        error: 'All delivery methods failed',
        timestamp: Date.now(),
      };
    }
  }
}

/** Singleton instance */
export const decisionEngine = new DecisionEngine();
