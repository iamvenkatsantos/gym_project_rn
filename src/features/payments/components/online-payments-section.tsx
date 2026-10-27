import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { PaymentRow } from '@/features/payments/components/payment-row';
import { useOnlinePayments, useOnlinePaymentsEnabled } from '@/features/payments/hooks';
import { paymentState, sortForStaff } from '@/features/payments/rules';

/**
 * Owners and supervisors: the latest payments members made in the app, with
 * anyone still on Razorpay's page first. Hidden until the branch takes them.
 */
export function OnlinePaymentsSection({ gymId }: { gymId: string }) {
  const enabled = useOnlinePaymentsEnabled(gymId);
  const payments = useOnlinePayments(gymId);
  const list = payments.data ?? [];
  if (!enabled.data && list.length === 0) return null;

  const pending = list.filter((p) => paymentState(p) === 'pending').length;
  return (
    <>
      <SectionHeader
        title="Online payments"
        detail={pending ? `${pending} paying now` : undefined}
      />
      {list.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {payments.isError
            ? `Couldn't load online payments: ${payments.error.message}`
            : 'Members can pay from their Profile. Payments show here, and as memberships below.'}
        </ThemedText>
      ) : (
        sortForStaff(list)
          .slice(0, 5)
          .map((p) => <PaymentRow key={p.id} payment={p} showMember />)
      )}
    </>
  );
}
