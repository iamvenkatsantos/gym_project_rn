import { RoleTabs } from '@/components/navigation/role-tabs';

export default function TrainerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Schedule', icon: 'calendar-outline' },
        { name: 'workouts', title: 'My workouts', icon: 'barbell-outline' },
        { name: 'members', title: 'Members', icon: 'people-outline' },
        { name: 'training', title: 'Training', icon: 'fitness-outline' },
      ]}
    />
  );
}
