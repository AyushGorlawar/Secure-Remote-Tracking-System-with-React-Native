/**
 * Example Encrypted Trigger Payload
 * ==================================
 * This file demonstrates how to construct a valid push notification
 * payload that the SRTS app will accept and process.
 *
 * Use this as a reference for your backend server implementation.
 */

import { generateHMAC } from '../app/utils/encryption';

/**
 * Generate a valid trigger payload for testing.
 *
 * @param deviceId - The target device's SRTS ID
 * @param secretKey - Shared HMAC secret key
 * @returns JSON payload ready to send via FCM/APNs
 *
 * @example
 * ```typescript
 * // Backend server (Node.js) example:
 *
 * const payload = {
 *   deviceId: 'SRTS-A1B2C3D4E5F6...',
 *   timestamp: Date.now(),
 *   hmac: computeHMAC(deviceId, timestamp, secretKey),
 *   command: 'LOCATE'
 * };
 *
 * // Send via Expo Push API:
 * await fetch('https://exp.host/--/api/v2/push/send', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     to: 'ExponentPushToken[...]',
 *     data: payload,            // Goes to notification.request.content.data
 *     priority: 'high',
 *     channelId: 'tracking',
 *     _contentAvailable: true,  // Enable silent push (iOS)
 *   }),
 * });
 * ```
 */
export async function generateExamplePayload(
  deviceId: string,
  secretKey: string,
) {
  const timestamp = Date.now();
  const hmac = await generateHMAC(deviceId, timestamp, secretKey);

  // This is the payload to put in the `data` field of the push notification
  const pushPayload = {
    deviceId,
    timestamp,
    hmac,
    command: 'LOCATE' as const, // 'LOCATE' | 'PING' | 'EMERGENCY'
  };

  // Full Expo push notification structure
  const expoPushMessage = {
    to: 'ExponentPushToken[REPLACE_WITH_REAL_TOKEN]',
    sound: null, // Silent push
    data: pushPayload,
    priority: 'high',
    channelId: 'tracking',
    _contentAvailable: true, // iOS background wake
  };

  return {
    pushPayload,
    expoPushMessage,
  };
}

/**
 * Example backend endpoint (Express.js reference):
 *
 * ```typescript
 * import express from 'express';
 * import crypto from 'crypto';
 *
 * const app = express();
 * app.use(express.json());
 *
 * // Receive encrypted location report
 * app.post('/api/v1/tracking/location', (req, res) => {
 *   const { encryptedPayload, deviceId, timestamp } = req.body;
 *
 *   // 1. Validate the request
 *   if (!encryptedPayload || !deviceId || !timestamp) {
 *     return res.status(400).json({ error: 'Missing required fields' });
 *   }
 *
 *   // 2. Check timestamp freshness
 *   if (Math.abs(Date.now() - timestamp) > 60000) {
 *     return res.status(401).json({ error: 'Stale request' });
 *   }
 *
 *   // 3. Decrypt and store location
 *   // ... decryption logic here ...
 *
 *   // 4. Respond with success
 *   res.json({
 *     success: true,
 *     receivedAt: Date.now(),
 *   });
 * });
 *
 * // Trigger a device to report its location
 * app.post('/api/v1/tracking/trigger', async (req, res) => {
 *   const { deviceId, pushToken } = req.body;
 *   const timestamp = Date.now();
 *   const hmac = crypto
 *     .createHmac('sha256', process.env.HMAC_SECRET!)
 *     .update(`${process.env.HMAC_SECRET}:${deviceId}:${timestamp}`)
 *     .digest('hex');
 *
 *   // Send push notification via Expo
 *   await fetch('https://exp.host/--/api/v2/push/send', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       to: pushToken,
 *       data: { deviceId, timestamp, hmac, command: 'LOCATE' },
 *       priority: 'high',
 *       _contentAvailable: true,
 *     }),
 *   });
 *
 *   res.json({ success: true, triggered: deviceId });
 * });
 *
 * app.listen(3000, () => console.log('SRTS Backend running on :3000'));
 * ```
 */
