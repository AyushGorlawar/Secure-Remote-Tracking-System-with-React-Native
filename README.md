# Secure Remote Tracking System (SRTS)

A production-ready React Native (Expo SDK 54) mobile application for **secure, remote device tracking** with encrypted communication, background execution, battery-aware emergency modes, and SMS fallback.

---

## Architecture

```
app/
├── _layout.tsx                    # Root layout — service initialization
├── index.tsx                      # Dashboard screen (home)
├── config/
│   ├── environment.ts             # Env vars, secrets, feature flags
│   └── backgroundTasks.ts         # TaskManager task definitions
├── services/
│   ├── index.ts                   # Barrel export
│   ├── triggerService.ts          # Push notification processing pipeline
│   ├── securityService.ts         # HMAC validation, SIM detection, device ID
│   ├── locationService.ts         # GPS with retry + SecureStore persistence
│   ├── decisionEngine.ts          # HTTPS vs SMS delivery logic
│   └── survivalMode.ts            # Battery monitoring + emergency pings
├── utils/
│   ├── index.ts                   # Barrel export
│   ├── encryption.ts              # HMAC, payload encryption, device ID gen
│   ├── network.ts                 # NetInfo, airplane mode, HTTP client
│   └── permissions.ts             # Centralized permission handling
└── types/
    └── index.ts                   # Shared TypeScript interfaces
examples/
└── examplePayload.ts              # Example push payload + backend reference
```

---

## Features

| Feature | Implementation |
|---|---|
| **FCM Silent Push** | `expo-notifications` — background trigger processing |
| **HMAC Validation** | SHA-256 HMAC with timing-safe comparison |
| **Timestamp Check** | Reject payloads older than 60 seconds |
| **GPS Location** | `expo-location` — BestForNavigation accuracy |
| **HTTPS Delivery** | Encrypted POST with retry + exponential backoff |
| **SMS Fallback** | `expo-sms` — Google Maps link when offline |
| **Battery Monitor** | `expo-battery` — emergency ping at <15% |
| **SecureStore** | Last known location persisted securely |
| **Background Fetch** | `expo-task-manager` + `expo-background-fetch` |
| **SIM Detection** | `expo-cellular` — carrier change placeholder |
| **Airplane Mode** | `@react-native-community/netinfo` detection |
| **Location Retry** | Up to 3 attempts with 2s delay between each |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio or Xcode (for native builds)
- EAS CLI for production builds (`npm install -g eas-cli`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/secure-remote-tracking-system.git
cd secure-remote-tracking-system

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your actual secret keys

# Start development server
npx expo start
```

### Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_HMAC_SECRET` | HMAC secret key (min 64 chars) |
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL |
| `EXPO_PUBLIC_EMERGENCY_SMS` | Emergency SMS number (E.164) |
| `EXPO_PUBLIC_PAYLOAD_ENC_KEY` | AES-256 encryption key (hex) |

---

## Trigger Pipeline

```
Push Notification Received
        │
        ▼
 ┌─────────────┐
 │  Validate    │──▶ Check timestamp (<60s)
 │  Payload     │──▶ Verify HMAC signature
 │  (Security)  │──▶ Match device ID
 └──────┬──────┘
        │ valid
        ▼
 ┌─────────────┐
 │  Battery     │──▶ Level < 15%? → Emergency Ping
 │  Check       │
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  Fetch GPS   │──▶ High accuracy (BestForNavigation)
 │  Location    │──▶ Retry up to 3 times
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  Decision    │──▶ Internet? → Encrypted HTTPS POST
 │  Engine      │──▶ No Internet? → SMS with Maps link
 │              │──▶ Both fail? → Store locally
 └─────────────┘
```

---

## Backend Integration

### Receiving Location Reports

Your backend should implement a `POST /api/v1/tracking/location` endpoint:

```typescript
// Express.js example
app.post('/api/v1/tracking/location', (req, res) => {
  const { encryptedPayload, deviceId, timestamp } = req.body;

  // 1. Validate freshness
  if (Math.abs(Date.now() - timestamp) > 60000) {
    return res.status(401).json({ error: 'Stale request' });
  }

  // 2. Decrypt payload
  // 3. Store location data
  // 4. Respond
  res.json({ success: true, receivedAt: Date.now() });
});
```

### Triggering a Device

Send a push notification via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/):

```json
{
  "to": "ExponentPushToken[...]",
  "data": {
    "deviceId": "SRTS-A1B2C3D4...",
    "timestamp": 1709500000000,
    "hmac": "a3f2b1c4d5e6...",
    "command": "LOCATE"
  },
  "priority": "high",
  "_contentAvailable": true
}
```

Commands: `LOCATE` (default), `PING`, `EMERGENCY`

---

## Required Permissions

### Android

| Permission | Purpose |
|---|---|
| `ACCESS_FINE_LOCATION` | GPS location |
| `ACCESS_BACKGROUND_LOCATION` | Background tracking |
| `FOREGROUND_SERVICE_LOCATION` | Foreground service for location |
| `POST_NOTIFICATIONS` | Android 13+ notification permission |
| `SEND_SMS` | SMS fallback delivery |
| `RECEIVE_BOOT_COMPLETED` | Auto-start on boot |
| `ACCESS_NETWORK_STATE` | Network/airplane mode detection |

### iOS

| Permission | Purpose |
|---|---|
| `NSLocationWhenInUseUsageDescription` | Foreground location |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Background location |
| `UIBackgroundModes` | `location`, `fetch`, `remote-notification` |

---

## Package Dependencies

| Package | Purpose |
|---|---|
| `expo-router` | File-based routing |
| `expo-location` | GPS location services |
| `expo-notifications` | Push notification handling |
| `expo-task-manager` | Background task execution |
| `expo-background-fetch` | Periodic background fetch |
| `expo-battery` | Battery level monitoring |
| `expo-secure-store` | Encrypted local storage |
| `expo-crypto` | HMAC and hashing |
| `expo-sms` | SMS sending |
| `expo-cellular` | SIM/carrier detection |
| `expo-device` | Device metadata |
| `expo-constants` | App constants |
| `@react-native-community/netinfo` | Network state detection |
| `react-native-get-random-values` | Crypto polyfill |

---

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

---

## Security Notes

1. **Never commit `.env` files** — use `.env.example` as a template
2. **Rotate HMAC keys** periodically on both client and server
3. **Use certificate pinning** in production for HTTPS requests
4. The XOR encryption in `encryption.ts` is a baseline — replace with **AES-256-GCM** via a native module for production
5. **Timestamp validation** prevents replay attacks (60-second window)
6. **Timing-safe comparison** prevents HMAC side-channel attacks

---

## License

MIT — See [LICENSE](LICENSE) for details.
