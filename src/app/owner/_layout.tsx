import { RoleTabs } from '@/components/navigation/role-tabs';

export default function OwnerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Dashboard' },
        { name: 'classes', title: 'Classes' },
        { name: 'memberships', title: 'Members' },
      ]}
    />
  );
}
