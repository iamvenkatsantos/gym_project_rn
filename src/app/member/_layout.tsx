import { RoleTabs } from '@/components/navigation/role-tabs';

// Tab order follows the CoreFit plan: Home · Workouts · Progress · Bookings · Profile.
export default function MemberLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home', icon: 'home-outline' },
        { name: 'workouts', title: 'Workouts', icon: 'barbell-outline' },
        { name: 'progress', title: 'Progress', icon: 'trending-up-outline' },
        { name: 'bookings', title: 'Bookings', icon: 'calendar-outline' },
        { name: 'profile', title: 'Profile', icon: 'person-outline' },
      ]}
    />
  );
}
