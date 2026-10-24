import { RoleTabs } from '@/components/navigation/role-tabs';

export default function MemberLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home', icon: 'home-outline' },
        { name: 'classes', title: 'Classes', icon: 'calendar-outline' },
        { name: 'workouts', title: 'Workouts', icon: 'barbell-outline' },
        { name: 'membership', title: 'Membership', icon: 'card-outline' },
      ]}
    />
  );
}
