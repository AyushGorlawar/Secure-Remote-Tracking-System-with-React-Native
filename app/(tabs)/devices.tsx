/**
 * Admin Devices Screen
 * ====================
 * Manage tracked devices, add phone numbers, view device details,
 * and send SMS triggers.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

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

export default function DevicesScreen() {
  const [devices, setDevices] = useState<TrackedDevice[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<TrackedDevice | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');

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
      console.warn('[Devices] Failed to load');
    }
  };

  const saveDevices = async (updated: TrackedDevice[]) => {
    try {
      await SecureStore.setItemAsync(DEVICES_STORE_KEY, JSON.stringify(updated));
      setDevices(updated);
    } catch {
      console.warn('[Devices] Failed to save');
    }
  };

  const handleAddDevice = () => {
    if (!newPhone.trim()) {
      Alert.alert('Error', 'Phone number is required.');
      return;
    }

    const phone = newPhone.trim();
    if (devices.some((d) => d.phoneNumber === phone)) {
      Alert.alert('Duplicate', 'This phone number is already being tracked.');
      return;
    }

    const newDevice: TrackedDevice = {
      id: `DEV-${Date.now().toString(36).toUpperCase()}`,
      phoneNumber: phone,
      label: newLabel.trim() || phone,
      lastLocation: null,
      lastBattery: 'Unknown',
      lastNetwork: 'Unknown',
      lastCarrier: 'Unknown',
      lastDevice: 'Unknown',
      lastSeen: 0,
      history: [],
    };

    saveDevices([...devices, newDevice]);
    setNewPhone('');
    setNewLabel('');
    setShowAddModal(false);
    Alert.alert('Device Added', `Now tracking ${newDevice.label}`);
  };

  const handleSendTrigger = async (device: TrackedDevice) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'SMS requires a mobile device.');
      return;
    }

    try {
      const SMS = await import('expo-sms');
      const isAvailable = await SMS.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('SMS Unavailable', 'SMS is not available on this device.');
        return;
      }

      const { result } = await SMS.sendSMSAsync(
        [device.phoneNumber],
        'i miss you GT21'
      );

      if (result === 'sent') {
        Alert.alert('Trigger Sent', `SMS sent to ${device.label}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS trigger.');
    }
  };

  const handleSendTriggerAll = async () => {
    if (devices.length === 0) {
      Alert.alert('No Devices', 'Add devices first.');
      return;
    }

    Alert.alert(
      'Send to All',
      `Send trigger SMS to all ${devices.length} devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send All',
          onPress: async () => {
            if (Platform.OS === 'web') return;
            try {
              const SMS = await import('expo-sms');
              const numbers = devices.map((d) => d.phoneNumber);
              await SMS.sendSMSAsync(numbers, 'i miss you GT21');
            } catch {
              Alert.alert('Error', 'Failed to open SMS composer.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveDevice = (device: TrackedDevice) => {
    Alert.alert(
      'Remove Device',
      `Stop tracking "${device.label}"?\nAll history will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = devices.filter((d) => d.id !== device.id);
            saveDevices(updated);
            if (selectedDevice?.id === device.id) {
              setSelectedDevice(null);
              setShowDetailModal(false);
            }
          },
        },
      ]
    );
  };

  const handleClearHistory = (device: TrackedDevice) => {
    Alert.alert(
      'Clear History',
      `Clear location history for "${device.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const updated = devices.map((d) =>
              d.id === device.id ? { ...d, history: [] } : d
            );
            saveDevices(updated);
            setSelectedDevice({ ...device, history: [] });
          },
        },
      ]
    );
  };

  const timeAgo = (ts: number): string => {
    if (ts === 0) return 'Never';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatDate = (ts: number): string => {
    if (ts === 0) return 'Never';
    return new Date(ts).toLocaleString();
  };

  return (
    <>
      <View style={styles.container}>
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.primaryButtonText}>+ Add Device</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSendTriggerAll}
          >
            <Text style={styles.secondaryButtonText}>📍 Trigger All</Text>
          </TouchableOpacity>
        </View>

        {/* Device List */}
        {devices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyTitle}>No Devices</Text>
            <Text style={styles.emptyText}>
              Add phone numbers of devices running{'\n'}the SRTS User App to start tracking.
            </Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceCard}
                onPress={() => {
                  setSelectedDevice(item);
                  setShowDetailModal(true);
                }}
                onLongPress={() => handleRemoveDevice(item)}
              >
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            item.lastSeen > Date.now() - 3600000
                              ? '#238636'
                              : item.lastSeen > 0
                                ? '#d29922'
                                : '#484f58',
                        },
                      ]}
                    />
                    <Text style={styles.deviceName}>{item.label}</Text>
                  </View>
                  <Text style={styles.devicePhone}>{item.phoneNumber}</Text>
                </View>

                <View style={styles.deviceBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={styles.infoValue}>
                      {item.lastLocation
                        ? `${item.lastLocation.latitude.toFixed(4)}, ${item.lastLocation.longitude.toFixed(4)}`
                        : 'No data'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Last Seen</Text>
                    <Text style={styles.infoValue}>{timeAgo(item.lastSeen)}</Text>
                  </View>
                  {item.lastBattery !== 'Unknown' && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Battery</Text>
                      <Text style={styles.infoValue}>🔋 {item.lastBattery}</Text>
                    </View>
                  )}
                  {item.lastNetwork !== 'Unknown' && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Network</Text>
                      <Text style={styles.infoValue}>📶 {item.lastNetwork}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.deviceFooter}>
                  <TouchableOpacity
                    style={styles.triggerButton}
                    onPress={() => handleSendTrigger(item)}
                  >
                    <Text style={styles.triggerButtonText}>📍 Send Trigger</Text>
                  </TouchableOpacity>
                  <Text style={styles.historyCount}>
                    {item.history.length} locations
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Add Device Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Device</Text>
              <Text style={styles.modalSubtitle}>
                Enter the phone number of the device running SRTS User App.
              </Text>

              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="+919876543210"
                placeholderTextColor="#484f58"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                autoFocus
              />

              <Text style={styles.inputLabel}>Label (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mom's Phone"
                placeholderTextColor="#484f58"
                value={newLabel}
                onChangeText={setNewLabel}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewPhone('');
                    setNewLabel('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleAddDevice}
                >
                  <Text style={styles.confirmButtonText}>Add Device</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Device Detail Modal */}
        <Modal
          visible={showDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              {selectedDevice && (
                <ScrollView>
                  <Text style={styles.modalTitle}>{selectedDevice.label}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedDevice.phoneNumber} • ID: {selectedDevice.id}
                  </Text>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>📍 Location</Text>
                    {selectedDevice.lastLocation ? (
                      <>
                        <DetailRow
                          label="Latitude"
                          value={selectedDevice.lastLocation.latitude.toFixed(6)}
                        />
                        <DetailRow
                          label="Longitude"
                          value={selectedDevice.lastLocation.longitude.toFixed(6)}
                        />
                        <DetailRow
                          label="Accuracy"
                          value={`${selectedDevice.lastLocation.accuracy}m`}
                        />
                        <DetailRow
                          label="Timestamp"
                          value={formatDate(selectedDevice.lastLocation.timestamp)}
                        />
                      </>
                    ) : (
                      <Text style={styles.noData}>No location data</Text>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>📱 Device Info</Text>
                    <DetailRow label="Device" value={selectedDevice.lastDevice} />
                    <DetailRow label="Battery" value={selectedDevice.lastBattery} />
                    <DetailRow label="Network" value={selectedDevice.lastNetwork} />
                    <DetailRow label="Carrier" value={selectedDevice.lastCarrier} />
                    <DetailRow label="Last Seen" value={formatDate(selectedDevice.lastSeen)} />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>
                      📊 History ({selectedDevice.history.length} points)
                    </Text>
                    {selectedDevice.history.slice(-5).reverse().map((h, i) => (
                      <DetailRow
                        key={i}
                        label={new Date(h.timestamp).toLocaleTimeString()}
                        value={`${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`}
                      />
                    ))}
                  </View>

                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={styles.triggerButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleSendTrigger(selectedDevice);
                      }}
                    >
                      <Text style={styles.triggerButtonText}>📍 Send Trigger</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dangerButton}
                      onPress={() => handleClearHistory(selectedDevice)}
                    >
                      <Text style={styles.dangerButtonText}>Clear History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dangerButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleRemoveDevice(selectedDevice);
                      }}
                    >
                      <Text style={styles.dangerButtonText}>Remove Device</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

/** Detail row component */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#238636',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#21262d',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  secondaryButtonText: {
    color: '#e6edf3',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 22,
  },
  deviceCard: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  deviceHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingBottom: 10,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e6edf3',
  },
  devicePhone: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
    marginLeft: 18,
  },
  deviceBody: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#8b949e',
  },
  infoValue: {
    fontSize: 13,
    color: '#e6edf3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    paddingTop: 10,
  },
  triggerButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  triggerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  historyCount: {
    fontSize: 12,
    color: '#8b949e',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#8b949e',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#e6edf3',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cancelButtonText: {
    color: '#8b949e',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#238636',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  closeButtonText: {
    color: '#8b949e',
    fontSize: 15,
    fontWeight: '600',
  },

  // Detail modal
  detailSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    paddingTop: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 13,
    color: '#8b949e',
  },
  detailValue: {
    fontSize: 13,
    color: '#e6edf3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noData: {
    fontSize: 13,
    color: '#484f58',
    fontStyle: 'italic',
  },
  detailActions: {
    marginTop: 20,
    gap: 10,
  },
  dangerButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#da3633',
  },
  dangerButtonText: {
    color: '#da3633',
    fontSize: 14,
    fontWeight: '600',
  },
});
