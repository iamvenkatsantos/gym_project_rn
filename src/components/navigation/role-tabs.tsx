import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useNavigation } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { type IconName } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { AccountButton } from '@/features/auth/components/account-button';
import { InboxButton } from '@/features/notifications/components/inbox-button';
import { useTheme } from '@/hooks/use-theme';

export type RoleTab = {
  name: string;
  title: string;
  icon: IconName;
};

/** Shared tab navigator for the member, trainer, supervisor and owner areas. */
export function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  const theme = useTheme();
  // The tabs live in one screen of the root stack. Naming that screen after the open tab means
  // screens pushed on top say "< People" or "< Home" on iOS, rather than the route ("< owner").
  const stackScreen = useNavigation();

  return (
    <Tabs
      screenListeners={({ route }) => ({
        focus: () => {
          const tab = tabs.find((t) => t.name === route.name);
          if (tab) stackScreen.setOptions({ title: tab.title });
        },
      })}
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 600 },
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 800 },
        headerRightContainerStyle: { paddingRight: Spacing.three },
        headerRight: () => (
          <View style={styles.actions}>
            <InboxButton />
            <AccountButton />
          </View>
        ),
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
