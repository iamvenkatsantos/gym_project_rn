import { RoleTabs } from '@/components/navigation/role-tabs';

/** CoreFit Gym's admin: just owners and what they pay. Gym work stays in each gym. */
export default function AdminLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Overview', icon: 'stats-chart-outline' },
        { name: 'owners', title: 'Owners', icon: 'people-outline' },
      ]}
      inbox={false}
    />
  );
}
