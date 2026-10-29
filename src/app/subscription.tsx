import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useActiveGym } from '@/features/auth/use-profile';
import { PlanAndPay } from '@/features/subscription/components/plan-and-pay';
import { useSubscription, useSubscriptionPayments } from '@/features/subscription/hooks';
import { paidYears } from '@/features/subscription/rules';
import type { SubscriptionPayment } from '@/features/subscription/types';
import { formatAmount, formatDate } from '@/lib/format';

/** Owners only: what this branch pays CoreFit Gym each year, and paying for the next year. */
export default function SubscriptionScreen() {
  const gym = useActiveGym();
  const subscription = useSubscription(gym.gymId);
  const payments = useSubscriptionPayments(gym.gymId);

  return (
    <Screen>
      <QueryState query={subscription}>
        {(sub) => <PlanAndPay gymId={gym.gymId} gymName={gym.gymName} sub={sub} />}
      </QueryState>
      {payments.data && paidYears(payments.data).length ? (
        <>
          <SectionHeader title="Paid years" />
          <ListGroup>
            {paidYears(payments.data).map((p, i) => (
              <ListRow
                key={p.id}
                divider={i > 0}
                icon={p.method === 'online' ? 'card-outline' : 'receipt-outline'}
                label={`${formatDate(p.periodStart!)} – ${formatDate(p.periodEnd!)}`}
                detail={paymentDetail(p)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}
    </Screen>
  );
}

function paymentDetail(p: SubscriptionPayment) {
  if (p.method === 'online') return `${formatAmount(p.amountCents, p.currency)} · Paid online`;
  if (p.amountCents === 0) return p.note ? `Free · ${p.note}` : 'Free';
  return `${formatAmount(p.amountCents, p.currency)} · ${p.note ?? 'Recorded by CoreFit Gym'}`;
}
