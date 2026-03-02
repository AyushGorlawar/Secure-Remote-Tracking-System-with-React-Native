/**
 * Location Service
 * ================
 * Handles GPS location fetching with high accuracy,
 * retry logic, and SecureStore persistence.
 */

import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { ENV } from '../config/environment';
import { LocationData, ServiceError } from '../types';
import { delay } from '../utils/network';

/**
 * LocationService — manages all location-related operations.
 */
class LocationService {
  private hasPermission = false;
  private hasBackgroundPermission = false;

  /**
   * Request foreground and background location permissions.
   * @returns Object indicating which permissions were granted
   */
  async requestPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    try {
      const { status: fgStatus } =
        await Location.requestForegroundPermissionsAsync();
      this.hasPermission = fgStatus === 'granted';

      if (this.hasPermission) {
        const { status: bgStatus } =
          await Location.requestBackgroundPermissionsAsync();
        this.hasBackgroundPermission = bgStatus === 'granted';
      }

      console.log(
        `[LocationService] Permissions — foreground: ${this.hasPermission}, background: ${this.hasBackgroundPermission}`,
      );

      return {
        foreground: this.hasPermission,
        background: this.hasBackgroundPermission,
      };
    } catch (error) {
      console.error('[LocationService] Permission request failed:', error);
      return { foreground: false, background: false };
    }
  }

  /**
   * Check current permission status without prompting.
   */
  async checkPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();

      this.hasPermission = fg.status === 'granted';
      this.hasBackgroundPermission = bg.status === 'granted';

      return {
        foreground: this.hasPermission,
        background: this.hasBackgroundPermission,
      };
    } catch (error) {
      console.error('[LocationService] Permission check failed:', error);
      return { foreground: false, background: false };
    }
  }

  /**
   * Fetch current high-accuracy GPS location with retry logic.
   *
   * If the first attempt fails, retries up to MAX_RETRIES times
   * with a delay between each attempt.
   *
   * @returns LocationData object
   * @throws ServiceError if all attempts fail
   */
  async getCurrentLocation(): Promise<LocationData> {
    if (!this.hasPermission) {
      const perms = await this.checkPermissions();
      if (!perms.foreground) {
        throw new ServiceError(
          'Location permission not granted',
          'LocationService',
          'NO_PERMISSION',
        );
      }
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= ENV.LOCATION.MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[LocationService] Fetching location (attempt ${attempt}/${ENV.LOCATION.MAX_RETRIES})...`,
        );

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        const locationData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        };

        // Persist to SecureStore
        await this.saveLastKnownLocation(locationData);

        console.log(
          `[LocationService] Location acquired: ${locationData.latitude}, ${locationData.longitude}`,
        );

        return locationData;
      } catch (error) {
        lastError = error;
        console.warn(
          `[LocationService] Attempt ${attempt} failed:`,
          error,
        );

        if (attempt < ENV.LOCATION.MAX_RETRIES) {
          await delay(ENV.LOCATION.RETRY_DELAY_MS);
        }
      }
    }

    // All retries exhausted — try returning last known location
    const lastKnown = await this.getLastKnownLocation();
    if (lastKnown) {
      console.warn(
        '[LocationService] Using last known location as fallback',
      );
      return lastKnown;
    }

    throw new ServiceError(
      `Failed to get location after ${ENV.LOCATION.MAX_RETRIES} attempts`,
      'LocationService',
      'LOCATION_FAILED',
      lastError,
    );
  }

  /**
   * Get the last known location from SecureStore.
   */
  async getLastKnownLocation(): Promise<LocationData | null> {
    try {
      const stored = await SecureStore.getItemAsync(
        ENV.SECURE_STORE_KEYS.LAST_KNOWN_LOCATION,
      );
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save location to SecureStore.
   */
  private async saveLastKnownLocation(
    location: LocationData,
  ): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        ENV.SECURE_STORE_KEYS.LAST_KNOWN_LOCATION,
        JSON.stringify(location),
      );
    } catch (error) {
      console.error(
        '[LocationService] Failed to save location to SecureStore:',
        error,
      );
    }
  }

  /**
   * Generate a Google Maps URL from coordinates.
   */
  generateMapsLink(latitude: number, longitude: number): string {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
}

/** Singleton instance */
export const locationService = new LocationService();
