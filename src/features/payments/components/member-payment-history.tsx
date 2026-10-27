import { QueryState } from '@/components/query-state';
import { useMemberships } from '@/features/memberships/hooks';
import { PaymentHistoryList } from '@/features/payments/components/payment-history-list';
import { memberHistory } from '@/features/payments/history';
import { useOnlinePayments } from '@/features/payments/hooks';

/** One member's payment history. RLS shows members only their own. */
export function MemberPaymentHistory({
  gymId,
  memberId,
  emptyText,
}: {
  gymId: string;
  memberId: string;
  emptyText: string;
}) {
  const memberships = useMemberships(gymId);
  // Missing in-app payments only cost the receipt links, so the list doesn't wait on them.
  const online = useOnlinePayments(gymId, memberId).data ?? [];

  return (
    <QueryState
      query={memberships}
      isEmpty={(list) => memberHistory(memberId, list, online).length === 0}
      emptyText={emptyText}>
      {(list) => <PaymentHistoryList entries={memberHistory(memberId, list, online)} />}
    </QueryState>
  );
}
