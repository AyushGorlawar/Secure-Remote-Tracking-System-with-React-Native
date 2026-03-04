/**
 * Background Tasks Configuration
 * ==============================
 * Registers and manages Expo TaskManager background tasks
 * for background fetch and background location updates.
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import { securityService } from '../services/securityService';
import { locationService } from '../services/locationService';
import { decisionEngine } from '../services/decisionEngine';
import { survivalMode } from '../services/survivalMode';
import { ENV } from './environment';

// ─── Task Names ─────────────────────────────────────────────────────

export const BACKGROUND_FETCH_TASK = 'SRTS_BACKGROUND_FETCH';
export const BACKGROUND_LOCATION_TASK = 'SRTS_BACKGROUND_LOCATION';

// ─── Task Definitions ───────────────────────────────────────────────

/**
 * Background fetch task — periodically checks battery status
 * and SIM changes when the app is backgrounded.
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[BackgroundFetch] Task executing...');

    // Check battery
    const battery = await survivalMode.checkBattery();
    if (battery.isLowPower) {
      console.warn('[BackgroundFetch] Low battery — emergency ping');
      await survivalMode.emergencyLocationPing();
    }

    // Check for SIM change
    await securityService.detectSimChange();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Background location task — processes location updates
 * received in the background.
 */
TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.error('[BackgroundLocation] Task error:', error);
      return;
    }

    if (data?.locations && data.locations.length > 0) {
      const latest = data.locations[data.locations.length - 1];

      const locationData = {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        altitude: latest.coords.altitude,
        accuracy: latest.coords.accuracy,
        heading: latest.coords.heading,
        speed: latest.coords.speed,
        timestamp: latest.timestamp,
      };

      console.log(
        '[BackgroundLocation] Received update:',
        locationData.latitude,
        locationData.longitude,
      );

      try {
        await decisionEngine.processAndDeliver(locationData);
      } catch (err) {
        console.error('[BackgroundLocation] Delivery failed:', err);
      }
    }
  },
);

// ─── Registration Functions ─────────────────────────────────────────

/**
 * Register the background fetch task with the OS.
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Denied ||
      status === BackgroundFetch.BackgroundFetchStatus.Restricted
    ) {
      console.warn(
        '[BackgroundTasks] Background fetch not available, status:',
        status,
      );
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: ENV.BACKGROUND_FETCH_INTERVAL,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[BackgroundTasks] Background fetch registered');
  } catch (error) {
    console.error('[BackgroundTasks] Background fetch registration failed:', error);
  }
}

/**
 * Start background location tracking.
 */
export async function startBackgroundLocation(): Promise<void> {
  try {
    const { background } = await locationService.checkPermissions();

    if (!background) {
      console.warn(
        '[BackgroundTasks] Background location permission not granted',
      );
      return;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );

    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 50, // meters
        deferredUpdatesInterval: 60_000, // 1 minute
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Secure Remote Tracking',
          notificationBody: 'Tracking is active',
          notificationColor: '#1a73e8',
        },
      });

      console.log('[BackgroundTasks] Background location started');
    }
  } catch (error) {
    console.error(
      '[BackgroundTasks] Background location start failed:',
      error,
    );
  }
}

/**
 * Stop background location tracking.
 */
export async function stopBackgroundLocation(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BackgroundTasks] Background location stopped');
    }
  } catch (error) {
    console.error(
      '[BackgroundTasks] Background location stop failed:',
      error,
    );
  }
}

/**
 * Unregister all background tasks.
 */
export async function unregisterAllTasks(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    await stopBackgroundLocation();
    console.log('[BackgroundTasks] All tasks unregistered');
  } catch (error) {
    console.error('[BackgroundTasks] Unregistration failed:', error);
  }
}
