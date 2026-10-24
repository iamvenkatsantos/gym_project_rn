import { RoleTabs } from '@/components/navigation/role-tabs';

export default function TrainerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Schedule' },
        { name: 'workouts', title: 'My workouts' },
      ]}
    />
  );
}
