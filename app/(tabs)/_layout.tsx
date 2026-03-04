/**
 * Tab Layout
 * ==========
 * Bottom tab navigation for the Admin app.
 * Tabs: Dashboard, Map, Devices
 */

import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0d1117',
          height: 56 + insets.top,
        },
        headerStatusBarHeight: insets.top,
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: '#161b22',
          borderTopColor: '#30363d',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#8b949e',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} />,
          headerTitle: 'SRTS Dashboard',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Live Map',
          tabBarIcon: ({ color }) => <TabIcon icon="🗺️" color={color} />,
          headerTitle: 'Live Map',
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color }) => <TabIcon icon="📱" color={color} />,
          headerTitle: 'Tracked Devices',
        }}
      />
    </Tabs>
  );
}

/** Simple emoji-based tab icon */
function TabIcon({ icon }: { icon: string; color: string }) {
  return (
    <Text style={{ fontSize: 20 }}>{icon}</Text>
  );
}
