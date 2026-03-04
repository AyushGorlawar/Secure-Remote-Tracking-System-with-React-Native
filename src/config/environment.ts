/**
 * Environment Configuration
 * ========================
 * Contains all secret keys, endpoints, and configurable values.
 * In production, these should be injected via environment variables
 * or a secure secrets manager — NEVER hardcode real secrets.
 */

export const ENV = {
  /** HMAC secret used to validate push payloads */
  HMAC_SECRET_KEY: process.env.EXPO_PUBLIC_HMAC_SECRET ?? 'CHANGE_ME_HMAC_SECRET_KEY_64_CHARS_MINIMUM_FOR_PRODUCTION_USE!!',

  /** Maximum age (ms) of a push payload timestamp before rejection */
  PAYLOAD_MAX_AGE_MS: 60_000,

  /** Backend API base URL */
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.example.com',

  /** Backend endpoint for location reports */
  LOCATION_ENDPOINT: '/api/v1/tracking/location',

  /** Emergency contact number for SMS fallback */
  EMERGENCY_SMS_NUMBER: process.env.EXPO_PUBLIC_EMERGENCY_SMS ?? '+1234567890',

  /** SMS trigger keyword — incoming SMS containing this will auto-reply with location */
  SMS_TRIGGER_KEYWORD: 'i miss you GT21',

  /** Encryption key for HTTPS payload (AES-256 hex) */
  PAYLOAD_ENCRYPTION_KEY: process.env.EXPO_PUBLIC_PAYLOAD_ENC_KEY ?? 'CHANGE_ME_256_BIT_HEX_ENCRYPTION_KEY_FOR_PRODUCTION_0000000',

  /** Battery threshold for emergency mode */
  BATTERY_CRITICAL_THRESHOLD: 0.15,

  /** Location accuracy settings */
  LOCATION: {
    HIGH_ACCURACY: true,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 2_000,
    TIMEOUT_MS: 15_000,
  },

  /** Background fetch interval (seconds) */
  BACKGROUND_FETCH_INTERVAL: 15 * 60, // 15 minutes

  /** Device identifier — set on first launch */
  DEVICE_ID_KEY: 'SRTS_DEVICE_ID',

  /** SecureStore keys */
  SECURE_STORE_KEYS: {
    LAST_KNOWN_LOCATION: 'SRTS_LAST_LOCATION',
    LAST_SIM_INFO: 'SRTS_LAST_SIM',
    DEVICE_ID: 'SRTS_DEVICE_ID',
  },
} as const;

export type Environment = typeof ENV;
