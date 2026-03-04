/**
 * Network Utilities
 * =================
 * Provides network state detection, airplane mode detection,
 * and HTTP client with retry logic.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { ENV } from '../config/environment';
import { NetworkStatus, ServiceError } from '../types';

/**
 * Get current network status including airplane mode detection.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  try {
    const state: NetInfoState = await NetInfo.fetch();

    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      isAirplaneMode: !state.isConnected && state.type === 'none',
    };
  } catch (error) {
    console.error('[NetworkUtils] Failed to get network status:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      isAirplaneMode: false,
    };
  }
}

/**
 * Check if the device has internet connectivity.
 */
export async function hasInternetConnection(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.isConnected && status.isInternetReachable;
}

/**
 * Check if airplane mode is likely active.
 */
export async function isAirplaneModeActive(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.isAirplaneMode;
}

/**
 * Subscribe to network state changes.
 *
 * @param callback - Function called when network state changes
 * @returns Unsubscribe function
 */
export function subscribeToNetworkChanges(
  callback: (status: NetworkStatus) => void,
): () => void {
  return NetInfo.addEventListener((state) => {
    callback({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      isAirplaneMode: !state.isConnected && state.type === 'none',
    });
  });
}

/**
 * Send an HTTPS POST request with retry logic.
 *
 * @param endpoint - Relative endpoint path
 * @param body - Request body (will be JSON-stringified)
 * @param maxRetries - Maximum number of retry attempts
 * @returns Response data
 */
export async function securePost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  maxRetries: number = 3,
): Promise<T> {
  const url = `${ENV.API_BASE_URL}${endpoint}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Timestamp': Date.now().toString(),
          'X-Client-Version': '1.0.0',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ServiceError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NetworkUtils',
          'HTTP_ERROR',
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      console.warn(
        `[NetworkUtils] POST attempt ${attempt}/${maxRetries} failed:`,
        error,
      );

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await delay(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  throw new ServiceError(
    `POST to ${endpoint} failed after ${maxRetries} attempts`,
    'NetworkUtils',
    'MAX_RETRIES_EXCEEDED',
    lastError,
  );
}

/**
 * Utility: delay for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
