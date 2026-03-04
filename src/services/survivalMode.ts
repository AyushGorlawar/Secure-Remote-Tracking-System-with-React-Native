/**
 * Survival Mode Service
 * =====================
 * Handles battery monitoring, emergency location pings,
 * and low-power optimizations.
 *
 * When battery drops below the critical threshold (15%),
 * an emergency location ping is triggered automatically.
 */

import * as Battery from 'expo-battery';
import { ENV } from '../config/environment';
import { BatteryStatus, TriggerResult, ServiceError } from '../types';
import { locationService } from './locationService';

/**
 * SurvivalMode — battery-aware emergency operations.
 */
class SurvivalMode {
  private batterySubscription: Battery.Subscription | null = null;
  private lastEmergencyPing: number = 0;
  private readonly MIN_PING_INTERVAL_MS = 60_000; // 1 minute cooldown

  /**
   * Initialize battery monitoring.
   * Subscribes to battery level changes and triggers
   * emergency pings when battery drops below threshold.
   */
  async initialize(): Promise<void> {
    try {
      // Subscribe to battery level changes
      this.batterySubscription = Battery.addBatteryLevelListener(
        ({ batteryLevel }) => {
          if (batteryLevel < ENV.BATTERY_CRITICAL_THRESHOLD) {
            this.onCriticalBattery(batteryLevel);
          }
        },
      );

      console.log('[SurvivalMode] Battery monitoring initialized');
    } catch (error) {
      console.error('[SurvivalMode] Initialization failed:', error);
    }
  }

  /**
   * Check current battery status.
   */
  async checkBattery(): Promise<BatteryStatus> {
    try {
      const [level, state] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);

      return {
        level,
        isCharging:
          state === Battery.BatteryState.CHARGING ||
          state === Battery.BatteryState.FULL,
        isLowPower: level < ENV.BATTERY_CRITICAL_THRESHOLD,
      };
    } catch (error) {
      console.error('[SurvivalMode] Battery check failed:', error);
      return {
        level: 1,
        isCharging: false,
        isLowPower: false,
      };
    }
  }

  /**
   * Execute an emergency location ping.
   * Fetches location and sends it using all available methods.
   *
   * @returns TriggerResult
   */
  async emergencyLocationPing(): Promise<TriggerResult> {
    const now = Date.now();

    // Prevent ping spam
    if (now - this.lastEmergencyPing < this.MIN_PING_INTERVAL_MS) {
      console.warn('[SurvivalMode] Emergency ping cooldown active');
      return {
        success: false,
        method: 'NONE',
        error: 'Cooldown active',
        timestamp: now,
      };
    }

    this.lastEmergencyPing = now;

    try {
      console.warn('[SurvivalMode] Executing emergency location ping!');

      const location = await locationService.getCurrentLocation();
      // Lazy import to break the circular dependency with decisionEngine
      const { decisionEngine } = require('./decisionEngine');
      const result = await decisionEngine.processAndDeliver(location);

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[SurvivalMode] Emergency ping failed:', error);

      return {
        success: false,
        method: 'NONE',
        error: message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Handle critical battery event.
   */
  private async onCriticalBattery(level: number): Promise<void> {
    console.warn(
      `[SurvivalMode] CRITICAL BATTERY: ${(level * 100).toFixed(0)}%`,
    );
    await this.emergencyLocationPing();
  }

  /**
   * Clean up battery monitoring subscriptions.
   */
  dispose(): void {
    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }
  }
}

/** Singleton instance */
export const survivalMode = new SurvivalMode();
