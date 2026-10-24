import { Tabs } from 'expo-router';

import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RoleTabsProps = {
  tabs: { name: string; title: string }[];
};

/** Shared tab navigator for the member, trainer and owner areas. */
export function RoleTabs({ tabs }: RoleTabsProps) {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: 600 },
        headerRightContainerStyle: { paddingRight: Spacing.three },
        headerRight: () => <SignOutButton />,
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}
