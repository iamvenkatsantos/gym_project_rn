import { RoleTabs } from '@/components/navigation/role-tabs';

export default function OwnerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Dashboard', icon: 'stats-chart-outline' },
        { name: 'classes', title: 'Classes', icon: 'calendar-outline' },
        { name: 'memberships', title: 'Members', icon: 'people-outline' },
      ]}
    />
  );
}
