/**
 * Home Screen (Dashboard)
 * =======================
 * Main dashboard showing system status, last known location,
 * battery level, network status, and manual trigger button.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { securityService } from './services/securityService';
import { locationService } from './services/locationService';
import { triggerService } from './services/triggerService';
import { survivalMode } from './services/survivalMode';
import { getNetworkStatus } from './utils/network';
import {
  LocationData,
  BatteryStatus,
  NetworkStatus,
  TriggerResult,
} from './types';

interface DashboardState {
  deviceId: string;
  lastLocation: LocationData | null;
  battery: BatteryStatus;
  network: NetworkStatus;
  lastTriggerResult: TriggerResult | null;
  isTriggering: boolean;
}

export default function HomeScreen() {
  const [state, setState] = useState<DashboardState>({
    deviceId: '---',
    lastLocation: null,
    battery: { level: 1, isCharging: false, isLowPower: false },
    network: {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      isAirplaneMode: false,
    },
    lastTriggerResult: null,
    isTriggering: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [battery, network, lastLocation] = await Promise.all([
        survivalMode.checkBattery(),
        getNetworkStatus(),
        locationService.getLastKnownLocation(),
      ]);

      let deviceId = '---';
      try {
        deviceId = securityService.getDeviceId();
      } catch {
        // Not initialized yet
      }

      setState((prev) => ({
        ...prev,
        deviceId,
        battery,
        network,
        lastLocation,
      }));
    } catch (error) {
      console.error('[HomeScreen] Failed to load status:', error);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10_000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  const handleManualTrigger = useCallback(async () => {
    setState((prev) => ({ ...prev, isTriggering: true }));

    try {
      const result = await triggerService.manualTrigger();
      setState((prev) => ({
        ...prev,
        lastTriggerResult: result,
        isTriggering: false,
      }));

      Alert.alert(
        result.success ? 'Success' : 'Failed',
        result.success
          ? `Location sent via ${result.method}`
          : `Error: ${result.error}`,
      );
    } catch (error) {
      setState((prev) => ({ ...prev, isTriggering: false }));
      Alert.alert('Error', 'Trigger failed. Check logs.');
    }
  }, []);

  const batteryPercent = (state.battery.level * 100).toFixed(0);
  const batteryColor =
    state.battery.level < 0.15
      ? '#ef4444'
      : state.battery.level < 0.3
        ? '#f59e0b'
        : '#22c55e';

  return (
    <>
      <Stack.Screen options={{ title: 'SRTS Dashboard' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Secure Remote Tracking</Text>
          <Text style={styles.subtitle}>System Dashboard</Text>
        </View>

        {/* Device Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {state.deviceId}
          </Text>
        </View>

        {/* Battery Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Battery</Text>
          <View style={styles.row}>
            <View
              style={[styles.indicator, { backgroundColor: batteryColor }]}
            />
            <Text style={styles.cardValue}>
              {batteryPercent}%{' '}
              {state.battery.isCharging ? '⚡ Charging' : ''}
            </Text>
          </View>
          {state.battery.isLowPower && (
            <Text style={styles.warning}>⚠ LOW BATTERY — Emergency mode active</Text>
          )}
        </View>

        {/* Network Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network</Text>
          <View style={styles.row}>
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor: state.network.isConnected
                    ? '#22c55e'
                    : '#ef4444',
                },
              ]}
            />
            <Text style={styles.cardValue}>
              {state.network.isConnected ? 'Connected' : 'Disconnected'} (
              {state.network.type})
            </Text>
          </View>
          {state.network.isAirplaneMode && (
            <Text style={styles.warning}>✈ Airplane mode detected</Text>
          )}
        </View>

        {/* Last Known Location */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last Location</Text>
          {state.lastLocation ? (
            <>
              <Text style={styles.cardValue}>
                {state.lastLocation.latitude.toFixed(6)},{' '}
                {state.lastLocation.longitude.toFixed(6)}
              </Text>
              <Text style={styles.cardMeta}>
                Accuracy: {state.lastLocation.accuracy?.toFixed(1)}m •{' '}
                {new Date(state.lastLocation.timestamp).toLocaleString()}
              </Text>
            </>
          ) : (
            <Text style={styles.cardValue}>No location data</Text>
          )}
        </View>

        {/* Last Trigger Result */}
        {state.lastTriggerResult && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last Trigger</Text>
            <Text
              style={[
                styles.cardValue,
                {
                  color: state.lastTriggerResult.success
                    ? '#22c55e'
                    : '#ef4444',
                },
              ]}
            >
              {state.lastTriggerResult.success ? 'SUCCESS' : 'FAILED'} via{' '}
              {state.lastTriggerResult.method}
            </Text>
            <Text style={styles.cardMeta}>
              {new Date(state.lastTriggerResult.timestamp).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Manual Trigger Button */}
        <TouchableOpacity
          style={[
            styles.triggerButton,
            state.isTriggering && styles.triggerButtonDisabled,
          ]}
          onPress={handleManualTrigger}
          disabled={state.isTriggering}
          activeOpacity={0.7}
        >
          <Text style={styles.triggerButtonText}>
            {state.isTriggering ? 'Processing...' : '📍 Manual Location Trigger'}
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          SRTS v1.0.0 • {Platform.OS} {Platform.Version}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 16,
    color: '#e6edf3',
    fontWeight: '500',
  },
  cardMeta: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  warning: {
    fontSize: 13,
    color: '#f59e0b',
    marginTop: 8,
    fontWeight: '600',
  },
  triggerButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  triggerButtonDisabled: {
    backgroundColor: '#30363d',
  },
  triggerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  footer: {
    textAlign: 'center',
    color: '#484f58',
    fontSize: 12,
    marginTop: 8,
  },
});
