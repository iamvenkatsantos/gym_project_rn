import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { callUrl, formatPhone, whatsappUrl } from '@/features/enquiries/rules';
import { useGymReferrals } from '@/features/referrals/hooks';
import { staffReferralLabel } from '@/features/referrals/rules';
import { STAFF_REFERRAL_DAYS } from '@/features/referrals/types';
import { formatRelativeDay } from '@/lib/format';

/**
 * Friends members referred in the last two weeks, to call. Owners and supervisors see all;
 * trainers see their own members' referrals.
 */
export default function ReferralsScreen() {
  const gym = useActiveGym();
  const referrals = useGymReferrals(gym.gymId);

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Last {STAFF_REFERRAL_DAYS} days
      </ThemedText>
      <QueryState
        query={referrals}
        isEmpty={(list) => list.length === 0}
        emptyText="No referrals lately.">
        {(list) =>
          list.map((r) => (
            <Card key={r.id}>
              <View style={styles.top}>
                <ThemedText type="smallBold" style={styles.flex}>
                  {r.fullName}
                </ThemedText>
                <Pill
                  label={staffReferralLabel(r.status)}
                  tone={
                    r.status === 'pending'
                      ? 'warning'
                      : r.status === 'joined'
                        ? 'success'
                        : 'neutral'
                  }
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {formatPhone(r.phone)} · by {r.referredByName} · {formatRelativeDay(r.createdAt)}
              </ThemedText>
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    label="Call"
                    icon="call"
                    size="compact"
                    onPress={() => Linking.openURL(callUrl(r.phone)).catch(() => {})}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="WhatsApp"
                    icon="logo-whatsapp"
                    variant="secondary"
                    size="compact"
                    onPress={() => Linking.openURL(whatsappUrl(r.phone)).catch(() => {})}
                  />
                </View>
              </View>
            </Card>
          ))
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
