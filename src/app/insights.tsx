import { useState } from 'react';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym } from '@/features/auth/use-profile';
import { BusiestHours } from '@/features/insights/components/busiest-hours';
import { MemberHealthView } from '@/features/insights/components/member-health';
import { RevenueTrend } from '@/features/insights/components/revenue-trend';
import { useBusiestHours, useMemberInsights, useRevenueByMonth } from '@/features/insights/hooks';
import { hourlyLoad, memberHealth } from '@/features/insights/rules';

const MONTHS = 6;
const HOUR_PERIODS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;

/** Owner only: revenue trend, active against lapsed members, and the gym's busiest hours. */
export default function InsightsScreen() {
  const gym = useActiveGym();
  const [hourPeriod, setHourPeriod] = useState<(typeof HOUR_PERIODS)[number]['value']>('30');
  const days = Number(hourPeriod);
  const revenue = useRevenueByMonth(gym.gymId, MONTHS);
  const members = useMemberInsights(gym.gymId);
  const hours = useBusiestHours(gym.gymId, days);

  return (
    <Screen>
      <SectionHeader title="Revenue" detail={`Last ${MONTHS} months`} />
      <QueryState query={revenue}>{(months) => <RevenueTrend months={months} />}</QueryState>

      <SectionHeader title="Members" />
      <QueryState query={members}>
        {(list) => <MemberHealthView health={memberHealth(list)} />}
      </QueryState>

      <SectionHeader title="Busiest hours" />
      <SegmentedControl options={[...HOUR_PERIODS]} value={hourPeriod} onChange={setHourPeriod} />
      <QueryState query={hours}>
        {(counts) => <BusiestHours load={hourlyLoad(counts)} days={days} />}
      </QueryState>
    </Screen>
  );
}
