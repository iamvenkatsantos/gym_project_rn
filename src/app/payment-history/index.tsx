import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useDebounced } from '@/features/members/hooks';
import { MemberPaymentHistory } from '@/features/payments/components/member-payment-history';
import type { MemberPayments } from '@/features/payments/history';
import { usePaymentMembers } from '@/features/payments/hooks';
import { formatAmount, formatDate } from '@/lib/format';

/** Members see their own payments; owners and supervisors pick a member. */
export default function PaymentHistoryScreen() {
  const gym = useActiveGym();
  const profile = useProfile();

  if (gym.role === 'member') {
    return (
      <Screen>
        <MemberPaymentHistory
          gymId={gym.gymId}
          memberId={profile.id}
          emptyText="No payments yet. They show here once you pay in the app or at the front desk."
        />
      </Screen>
    );
  }
  return <StaffPaymentHistory gymId={gym.gymId} />;
}

function StaffPaymentHistory({ gymId }: { gymId: string }) {
  const [query, setQuery] = useState('');
  const members = usePaymentMembers(gymId, useDebounced(query));

  return (
    <Screen>
      <TextField
        label="Find a member"
        icon="search"
        placeholder="Search by name"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <QueryState
        query={members}
        isEmpty={(data) => data.pages[0].total === 0 && !query.trim()}
        emptyText="No payments yet. They show here once you record one or a member pays in the app.">
        {(data) => {
          const shown = data.pages.flatMap((page) => page.members);
          const total = data.pages[0].total;
          const loaded = shown.length;
          return (
            <>
              <SectionHeader title="Members" detail={`${total} paid`} />
              {shown.length === 0 ? (
                <ThemedText themeColor="textSecondary">Nobody by that name.</ThemedText>
              ) : (
                shown.map((m) => <MemberPaymentsRow key={m.memberId} member={m} />)
              )}
              {members.hasNextPage ? (
                <Button
                  label={`Show more (${loaded} of ${total})`}
                  variant="secondary"
                  loading={members.isFetchingNextPage}
                  onPress={() => members.fetchNextPage()}
                />
              ) : null}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function MemberPaymentsRow({ member }: { member: MemberPayments }) {
  const total = formatAmount(member.totalCents, member.currency);
  const count = `${member.payments} ${member.payments === 1 ? 'payment' : 'payments'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${member.memberName}, ${count}, ${total}`}
      onPress={() =>
        router.push({
          pathname: '/payment-history/[memberId]',
          params: { memberId: member.memberId, name: member.memberName },
        })
      }>
      <Card style={styles.card}>
        <View style={styles.top}>
          <ThemedText type="smallBold" style={styles.flex}>
            {member.memberName}
          </ThemedText>
          <ThemedText type="smallBold">{total}</ThemedText>
          <Icon name="chevron-forward" size={16} />
        </View>
        <View style={styles.meta}>
          <ThemedText type="small" themeColor="textSecondary">
            {count}
            {member.lastPaidAt ? ` · last ${formatDate(member.lastPaidAt)}` : ''}
          </ThemedText>
          {member.pending ? <Pill label="Paying now" tone="warning" /> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
