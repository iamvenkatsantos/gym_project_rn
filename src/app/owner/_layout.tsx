import { RoleTabs } from '@/components/navigation/role-tabs';

export default function OwnerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Dashboard', icon: 'stats-chart-outline' },
        { name: 'people', title: 'People', icon: 'people-outline' },
        { name: 'training', title: 'Training', icon: 'fitness-outline' },
        { name: 'classes', title: 'Classes', icon: 'calendar-outline' },
        { name: 'memberships', title: 'Memberships', icon: 'card-outline' },
      ]}
    />
  );
}
