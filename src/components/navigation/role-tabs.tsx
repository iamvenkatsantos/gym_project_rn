import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { type IconName } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { AccountButton } from '@/features/auth/components/account-button';
import { useTheme } from '@/hooks/use-theme';

export type RoleTab = {
  name: string;
  title: string;
  icon: IconName;
};

/** Shared tab navigator for the member, trainer and owner areas. */
export function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 600 },
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 800 },
        headerRightContainerStyle: { paddingRight: Spacing.three },
        headerRight: () => <AccountButton />,
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
