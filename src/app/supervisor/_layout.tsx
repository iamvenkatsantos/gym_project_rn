import { RoleTabs } from '@/components/navigation/role-tabs';

export default function SupervisorLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Dashboard', icon: 'stats-chart-outline' },
        { name: 'people', title: 'People', icon: 'people-outline' },
        { name: 'classes', title: 'Classes', icon: 'calendar-outline' },
        { name: 'memberships', title: 'Payments', icon: 'card-outline' },
      ]}
    />
  );
}
