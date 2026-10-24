import { RoleTabs } from '@/components/navigation/role-tabs';

export default function MemberLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home' },
        { name: 'classes', title: 'Classes' },
        { name: 'workouts', title: 'Workouts' },
        { name: 'membership', title: 'Membership' },
      ]}
    />
  );
}
