import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { MembershipPlan } from '@/features/memberships/types';
import { formatPrice } from '@/lib/format';

export function PlanCard({ plan }: { plan: MembershipPlan }) {
  return (
    <Card>
      <ThemedText type="smallBold">{plan.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatPrice(plan.priceCents, plan.currency)} for {plan.durationDays} days
      </ThemedText>
    </Card>
  );
}
