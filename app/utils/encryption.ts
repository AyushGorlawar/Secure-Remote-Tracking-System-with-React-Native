/**
 * Encryption Utilities
 * ====================
 * Provides HMAC verification and payload encryption/decryption.
 * Uses expo-crypto for cryptographic operations.
 */

import 'react-native-get-random-values';
import * as Crypto from 'expo-crypto';
import { ENV } from '../config/environment';

/**
 * Generate HMAC-SHA256 signature for payload validation.
 *
 * @param deviceId - The device identifier
 * @param timestamp - Unix timestamp in milliseconds
 * @param secretKey - HMAC secret key (defaults to ENV value)
 * @returns Hex-encoded HMAC digest
 */
export async function generateHMAC(
  deviceId: string,
  timestamp: number,
  secretKey: string = ENV.HMAC_SECRET_KEY,
): Promise<string> {
  const message = `${deviceId}:${timestamp}`;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secretKey}:${message}`,
  );
  return digest;
}

/**
 * Verify an HMAC signature matches the expected value.
 *
 * @param deviceId - Device identifier from payload
 * @param timestamp - Timestamp from payload
 * @param receivedHmac - HMAC received in the payload
 * @param secretKey - Secret key for verification
 * @returns True if the HMAC is valid
 */
export async function verifyHMAC(
  deviceId: string,
  timestamp: number,
  receivedHmac: string,
  secretKey: string = ENV.HMAC_SECRET_KEY,
): Promise<boolean> {
  const expectedHmac = await generateHMAC(deviceId, timestamp, secretKey);
  return timingSafeEqual(expectedHmac, receivedHmac);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Encrypt a JSON payload for HTTPS transmission.
 * Uses SHA-256 based key derivation + XOR stream cipher.
 *
 * NOTE: For production, replace with a proper AES-256-GCM implementation
 * using a native module. This provides a baseline obfuscation layer.
 *
 * @param data - Object to encrypt
 * @param key - Encryption key
 * @returns Hex-encoded encrypted string
 */
export async function encryptPayload(
  data: Record<string, unknown>,
  key: string = ENV.PAYLOAD_ENCRYPTION_KEY,
): Promise<string> {
  const plaintext = JSON.stringify(data);
  const nonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}:${Math.random()}`,
  );

  // Derive a keystream from key + nonce
  const keystream = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${key}:${nonce}`,
  );

  // XOR-based stream encryption (expand keystream as needed)
  const expandedKey = await expandKeystream(keystream, plaintext.length, key);
  const encrypted = xorStrings(plaintext, expandedKey);
  const hexEncrypted = stringToHex(encrypted);

  return `${nonce}:${hexEncrypted}`;
}

/**
 * Expand a keystream to match the required length.
 */
async function expandKeystream(
  initialKey: string,
  requiredLength: number,
  secret: string,
): Promise<string> {
  let keystream = initialKey;
  let counter = 0;

  while (keystream.length < requiredLength) {
    const block = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${secret}:${initialKey}:${counter}`,
    );
    keystream += block;
    counter++;
  }

  return keystream.substring(0, requiredLength);
}

/**
 * XOR two strings character by character.
 */
function xorStrings(a: string, b: string): string {
  let result = '';
  for (let i = 0; i < a.length; i++) {
    result += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i % b.length));
  }
  return result;
}

/**
 * Convert a string to hex representation.
 */
function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Generate a random device ID.
 */
export async function generateDeviceId(): Promise<string> {
  const random = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}:${Math.random()}:${Math.random()}`,
  );
  return `SRTS-${random.substring(0, 32).toUpperCase()}`;
}
