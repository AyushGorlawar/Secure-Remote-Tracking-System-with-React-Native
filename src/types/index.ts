/**
 * Shared Type Definitions
 * =======================
 */

/** GPS location data */
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

/** Encrypted push notification payload */
export interface TriggerPayload {
  /** Unique device identifier */
  deviceId: string;
  /** Unix timestamp (ms) when the push was created */
  timestamp: number;
  /** HMAC-SHA256 signature: HMAC(deviceId + timestamp, secretKey) */
  hmac: string;
  /** Optional command to execute */
  command?: 'LOCATE' | 'PING' | 'EMERGENCY';
}

/** Location report sent to backend */
export interface LocationReport {
  deviceId: string;
  location: LocationData;
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  timestamp: number;
  /** Hex-encoded encrypted payload */
  encryptedPayload?: string;
}

/** Result of a trigger processing operation */
export interface TriggerResult {
  success: boolean;
  method: 'HTTPS' | 'SMS' | 'STORED' | 'NONE';
  error?: string;
  location?: LocationData;
  timestamp: number;
}

/** Battery status */
export interface BatteryStatus {
  level: number;
  isCharging: boolean;
  isLowPower: boolean;
}

/** Network status */
export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isAirplaneMode: boolean;
}

/** SIM information for change detection */
export interface SimInfo {
  carrier: string | null;
  isoCountryCode: string | null;
  mobileCountryCode: string | null;
  mobileNetworkCode: string | null;
}

/** Service error with context */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
