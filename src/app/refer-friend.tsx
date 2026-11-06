import { useState } from 'react';
import { Linking } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { normalizePhone, whatsappUrl } from '@/features/enquiries/rules';
import { useMemberRules } from '@/features/member-rules/hooks';
import { useMyReferrals, useReferFriend } from '@/features/referrals/hooks';
import { referralLabel, referralMessage } from '@/features/referrals/rules';
import { firstError, validateName, validatePhone } from '@/lib/validation';

/** Members pass a friend's name and mobile to the front desk, then tell them on WhatsApp. */
export default function ReferFriendScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const reward = useMemberRules(gym.gymId).data?.referralRewardDays ?? 0;
  const referrals = useMyReferrals(gym.gymId, profile.id);
  const refer = useReferFriend(gym.gymId, profile.id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<{ name: string; phone: string } | null>(null);
  const [tried, setTried] = useState(false);

  const nameError = validateName(name);
  const phoneError = validatePhone(phone);
  const problem = firstError(nameError, phoneError);

  const submit = () => {
    setTried(true);
    if (problem) return;
    const friend = { fullName: name.trim(), phone: normalizePhone(phone) };
    refer.mutate(friend, {
      onSuccess: () => {
        setSent({ name: friend.fullName, phone: friend.phone });
        setName('');
        setPhone('');
        setTried(false);
      },
    });
  };

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        {reward > 0
          ? `Get ${reward} free days when your friend joins.`
          : 'The gym will call your friend.'}
      </ThemedText>

      {sent ? (
        <Card>
          <ThemedText type="smallBold">Thanks! The gym will call {sent.name}.</ThemedText>
          <Button
            label="Tell them on WhatsApp"
            icon="logo-whatsapp"
            variant="secondary"
            size="compact"
            onPress={() =>
              Linking.openURL(
                whatsappUrl(sent.phone, referralMessage(sent.name, gym.gymName)),
              ).catch(() => {})
            }
          />
        </Card>
      ) : null}

      <TextField
        label="Friend's name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        textContentType="name"
        error={nameError}
        showError={tried}
      />
      <TextField
        label="Their mobile"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        error={phoneError}
        showError={tried}
      />
      {refer.error ? <ThemedText themeColor="danger">{refer.error.message}</ThemedText> : null}
      <Button label="Refer" icon="gift-outline" loading={refer.isPending} onPress={submit} />

      <SectionHeader title="Your referrals" />
      <QueryState
        query={referrals}
        isEmpty={(list) => list.length === 0}
        emptyText="No referrals yet.">
        {(list) =>
          list.map((r) => (
            <Card key={r.id}>
              <ThemedText type="smallBold">{r.fullName}</ThemedText>
              <Pill
                label={referralLabel(r)}
                tone={
                  r.status === 'joined' ? 'success' : r.status === 'closed' ? 'neutral' : 'accent'
                }
              />
            </Card>
          ))
        }
      </QueryState>
    </Screen>
  );
}
