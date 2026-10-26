import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { upcomingDays } from '@/features/bookings/rules';
import { FollowUpPicker } from '@/features/enquiries/components/follow-up-picker';
import {
  useConvertEnquiry,
  useDeleteEnquiry,
  useEnquiries,
  useEnquiryNotes,
  useLogFollowUp,
  useUpdateEnquiry,
} from '@/features/enquiries/hooks';
import {
  callUrl,
  defaultFollowUp,
  followUpKinds,
  followUpLabel,
  followUpProblem,
  formatPhone,
  isOpen,
  isOverdue,
  lostReasons,
  sourceLabels,
  statusLabels,
  statusTones,
  trialDates,
  trialFollowUp,
  trialLengths,
  trialProgress,
  whatsappUrl,
} from '@/features/enquiries/rules';
import type { Enquiry, EnquiryNote, FollowUpKind } from '@/features/enquiries/types';
import type { InviteOutcome } from '@/features/members/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDateTime } from '@/lib/format';
import { normalizeEmail, validateEmail, validateOptionalText } from '@/lib/validation';

type Panel = 'followUp' | 'trial' | 'convert' | 'lost' | 'delete' | null;

/** One enquiry: who they are, what happens next, and everything said so far. */
export default function EnquiryScreen() {
  const { enquiryId } = useLocalSearchParams<{ enquiryId: string }>();
  const gym = useActiveGym();
  const enquiries = useEnquiries(gym.gymId);
  const enquiry = enquiries.data?.find((e) => e.id === enquiryId);

  if (!enquiry) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Enquiry' }} />
        {enquiries.isPending ? (
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        ) : (
          <QueryState query={enquiries}>
            {() => <ThemedText themeColor="textSecondary">This enquiry was deleted.</ThemedText>}
          </QueryState>
        )}
      </Screen>
    );
  }
  return <EnquiryDetail gymId={gym.gymId} gymName={gym.gymName} enquiry={enquiry} />;
}

function EnquiryDetail({
  gymId,
  gymName,
  enquiry,
}: {
  gymId: string;
  gymName: string;
  enquiry: Enquiry;
}) {
  const gym = useActiveGym();
  const notes = useEnquiryNotes(enquiry.id);
  const update = useUpdateEnquiry();
  const [panel, setPanel] = useState<Panel>(null);
  const open = isOpen(enquiry);
  const trial = enquiry.status === 'trial' ? trialProgress(enquiry) : null;
  const toggle = (next: Panel) => {
    update.reset();
    setPanel((current) => (current === next ? null : next));
  };
  const firstName = enquiry.fullName.split(' ')[0];

  return (
    <Screen>
      <Stack.Screen options={{ title: enquiry.fullName }} />
      <Card>
        <View style={styles.header}>
          <ThemedText type="heading" style={styles.flex}>
            {enquiry.fullName}
          </ThemedText>
          <Pill label={statusLabels[enquiry.status]} tone={statusTones[enquiry.status]} />
        </View>
        <Detail icon="call-outline" text={formatPhone(enquiry.phone)} />
        {enquiry.email ? <Detail icon="mail-outline" text={enquiry.email} /> : null}
        {enquiry.interest ? <Detail icon="flag-outline" text={enquiry.interest} /> : null}
        <Detail
          icon="time-outline"
          text={`${sourceLabels[enquiry.source]} · ${formatDate(enquiry.createdAt)}`}
        />
        {enquiry.nextFollowUpAt ? (
          <ThemedText type="smallBold" themeColor={isOverdue(enquiry) ? 'danger' : 'accent'}>
            {followUpLabel(enquiry.nextFollowUpAt)}
          </ThemedText>
        ) : open ? (
          <ThemedText type="small" themeColor="textSecondary">
            No follow-up set.
          </ThemedText>
        ) : null}
        {trial ? (
          <ThemedText type="smallBold" themeColor="success">
            Trial pass {formatDate(enquiry.trialStartsOn!)} – {formatDate(enquiry.trialEndsOn!)}
            {' · '}
            {trial.label}
          </ThemedText>
        ) : null}
        {enquiry.status === 'lost' && enquiry.lostReason ? (
          <ThemedText type="small" themeColor="textSecondary">
            Reason: {enquiry.lostReason}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label="Call"
              icon="call"
              size="compact"
              onPress={() => Linking.openURL(callUrl(enquiry.phone)).catch(() => {})}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="WhatsApp"
              icon="logo-whatsapp"
              size="compact"
              variant="secondary"
              onPress={() =>
                Linking.openURL(
                  whatsappUrl(enquiry.phone, `Hi ${firstName}, this is ${gymName}. `),
                ).catch(() => {})
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="Edit"
              icon="create-outline"
              size="compact"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/enquiry-editor', params: { enquiryId: enquiry.id } })
              }
            />
          </View>
        </View>
      </Card>

      <SectionHeader title="Next step" />
      <ListGroup>
        {open ? (
          <ListRow
            icon="chatbubble-ellipses-outline"
            label="Log a follow-up"
            detail="A call, visit or note, and when to follow up next"
            onPress={() => toggle('followUp')}
          />
        ) : null}
        {panel === 'followUp' ? (
          <FollowUpForm enquiry={enquiry} onDone={() => setPanel(null)} />
        ) : null}
        {open ? (
          <ListRow
            icon="ticket-outline"
            label={enquiry.status === 'trial' ? 'Change the trial pass' : 'Give a trial pass'}
            detail="Let them train free for a few days"
            divider
            onPress={() => toggle('trial')}
          />
        ) : null}
        {panel === 'trial' ? <TrialForm enquiry={enquiry} onDone={() => setPanel(null)} /> : null}
        {enquiry.status !== 'joined' ? (
          <ListRow
            icon="person-add-outline"
            label="Make them a member"
            detail="Invite them by email to join the gym"
            divider={open}
            onPress={() => toggle('convert')}
          />
        ) : null}
        {panel === 'convert' ? <ConvertForm gymId={gymId} enquiry={enquiry} /> : null}
        {enquiry.memberId ? (
          <>
            <ListRow
              icon="card-outline"
              label="Record a payment"
              detail="Start their membership"
              onPress={() =>
                router.push({
                  pathname: '/record-membership',
                  params: { memberId: enquiry.memberId! },
                })
              }
            />
            <ListRow
              icon="person-outline"
              label="View their profile"
              divider
              onPress={() =>
                router.push({ pathname: '/person/[userId]', params: { userId: enquiry.memberId! } })
              }
            />
          </>
        ) : enquiry.status === 'joined' ? (
          <ListRow
            icon="hourglass-outline"
            label="Invited as a member"
            detail="This links to their account once they sign up with the same email."
          />
        ) : null}
        {open ? (
          <ListRow
            icon="close-circle-outline"
            label="Mark as lost"
            detail="They decided not to join"
            tone="danger"
            divider
            onPress={() => toggle('lost')}
          />
        ) : (
          <ListRow
            icon="refresh-outline"
            label="Reopen"
            detail="Start following up again"
            divider
            onPress={() =>
              update.mutate({
                enquiryId: enquiry.id,
                patch: { status: 'following_up', nextFollowUpAt: defaultFollowUp().toISOString() },
              })
            }
          />
        )}
        {panel === 'lost' ? <LostForm enquiry={enquiry} onDone={() => setPanel(null)} /> : null}
        {gym.role === 'owner' ? (
          <ListRow
            icon="trash-outline"
            label="Delete enquiry"
            detail="For duplicates or mistakes"
            tone="danger"
            divider
            onPress={() => toggle('delete')}
          />
        ) : null}
        {panel === 'delete' ? <DeleteForm enquiry={enquiry} /> : null}
      </ListGroup>
      {update.error ? <ThemedText themeColor="danger">{update.error.message}</ThemedText> : null}

      <SectionHeader title="Timeline" />
      <QueryState
        query={notes}
        isEmpty={(list) => list.length === 0}
        emptyText="Nothing logged yet.">
        {(list) => (
          <Card>
            {list.map((note, i) => (
              <NoteRow key={note.id} note={note} divider={i > 0} />
            ))}
          </Card>
        )}
      </QueryState>
    </Screen>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={16} />
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const noteIcons: Record<EnquiryNote['kind'], IconName> = {
  call: 'call-outline',
  visit: 'walk-outline',
  note: 'document-text-outline',
  status: 'flag-outline',
};

function NoteRow({ note, divider }: { note: EnquiryNote; divider: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.note,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <Icon
        name={noteIcons[note.kind]}
        size={18}
        color={note.kind === 'status' ? 'accent' : 'textSecondary'}
      />
      <View style={styles.flex}>
        <ThemedText type={note.kind === 'status' ? 'smallBold' : 'small'}>{note.body}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(note.createdAt)}
          {note.authorName ? ` · ${note.authorName}` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

function FollowUpForm({ enquiry, onDone }: { enquiry: Enquiry; onDone: () => void }) {
  const log = useLogFollowUp(enquiry.id);
  const [kind, setKind] = useState<FollowUpKind>('call');
  const [body, setBody] = useState('');
  const [next, setNext] = useState<Date | null>(() =>
    enquiry.nextFollowUpAt && Date.parse(enquiry.nextFollowUpAt) > Date.now()
      ? new Date(enquiry.nextFollowUpAt)
      : defaultFollowUp(),
  );
  const bodyError = validateOptionalText(body, 500);
  const nextError = followUpProblem(next);

  return (
    <View style={styles.panel}>
      <SegmentedControl<FollowUpKind> options={followUpKinds} value={kind} onChange={setKind} />
      <TextField
        label="What happened"
        placeholder={
          kind === 'call'
            ? 'e.g. Busy, call back after 6'
            : kind === 'visit'
              ? 'e.g. Came for a tour, liked the cardio area'
              : 'Anything worth remembering'
        }
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={500}
        error={bodyError}
      />
      <FollowUpPicker value={next} onChange={setNext} />
      {nextError ? (
        <ThemedText type="small" themeColor="danger">
          {nextError}
        </ThemedText>
      ) : null}
      {log.error ? <ThemedText themeColor="danger">{log.error.message}</ThemedText> : null}
      <Button
        label="Save follow-up"
        icon="checkmark"
        disabled={!!bodyError || !!nextError}
        loading={log.isPending}
        onPress={() =>
          log.mutate({ kind, body, nextAt: next?.toISOString() ?? null }, { onSuccess: onDone })
        }
      />
    </View>
  );
}

function TrialForm({ enquiry, onDone }: { enquiry: Enquiry; onDone: () => void }) {
  const update = useUpdateEnquiry();
  const days = useMemo(() => upcomingDays(7), []);
  const [start, setStart] = useState(days[0]);
  const [length, setLength] = useState(3);
  const dates = trialDates(start, length);

  return (
    <View style={styles.panel}>
      <ThemedText type="label" themeColor="textSecondary">
        Starts
      </ThemedText>
      <DateStrip days={days} selected={start} onSelect={setStart} />
      <ThemedText type="label" themeColor="textSecondary">
        Length
      </ThemedText>
      <View style={styles.wrap}>
        {trialLengths.map((d) => (
          <Chip
            key={d}
            label={d === 1 ? '1 day' : `${d} days`}
            selected={length === d}
            onPress={() => setLength(d)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(dates.trialStartsOn)} to {formatDate(dates.trialEndsOn)}. We&apos;ll remind you
        to follow up on the last day.
      </ThemedText>
      {update.error ? <ThemedText themeColor="danger">{update.error.message}</ThemedText> : null}
      <Button
        label="Give trial pass"
        icon="ticket-outline"
        loading={update.isPending}
        onPress={() =>
          update.mutate(
            {
              enquiryId: enquiry.id,
              patch: {
                status: 'trial',
                ...dates,
                nextFollowUpAt: trialFollowUp(dates.trialEndsOn).toISOString(),
              },
            },
            { onSuccess: onDone },
          )
        }
      />
    </View>
  );
}

function describeInvite({ result, emailSent, emailError }: InviteOutcome, email: string) {
  switch (result) {
    case 'added':
      return 'They already had a CoreFit Gym account, so they are a member now. Record their payment to start the membership.';
    case 'already_member':
      return 'They are already at this gym. Find them under People.';
    case 'invited':
      return emailSent
        ? `We emailed ${email} an invite. They join as a member once they set a password.`
        : `${emailError ? `We couldn't email them: ${emailError.replace(/\.?$/, '.')}` : "We couldn't email them."} Ask them to install CoreFit Gym and sign up with this email.`;
  }
}

function ConvertForm({ gymId, enquiry }: { gymId: string; enquiry: Enquiry }) {
  const convert = useConvertEnquiry(gymId, enquiry.id);
  const [email, setEmail] = useState(enquiry.email ?? '');
  const emailError = validateEmail(email);

  if (convert.data) {
    return (
      <View style={styles.panel}>
        <View style={styles.detail}>
          <Icon name="checkmark-circle" size={22} color="accent" />
          <ThemedText type="smallBold">Done</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {describeInvite(convert.data, convert.variables)}
        </ThemedText>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <TextField
        label="Their email"
        placeholder="name@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={254}
        error={emailError}
      />
      <ThemedText type="small" themeColor="textSecondary">
        We email them an invite to join as a member. This enquiry links to their account when they
        do.
      </ThemedText>
      {convert.error ? <ThemedText themeColor="danger">{convert.error.message}</ThemedText> : null}
      <Button
        label="Send member invite"
        icon="send-outline"
        disabled={!!emailError}
        loading={convert.isPending}
        onPress={() => convert.mutate(normalizeEmail(email))}
      />
    </View>
  );
}

function LostForm({ enquiry, onDone }: { enquiry: Enquiry; onDone: () => void }) {
  const update = useUpdateEnquiry();
  const [reason, setReason] = useState('');
  const reasonError = validateOptionalText(reason, 200);

  return (
    <View style={styles.panel}>
      <ThemedText type="label" themeColor="textSecondary">
        Why
      </ThemedText>
      <View style={styles.wrap}>
        {lostReasons.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={reason === r}
            onPress={() => setReason(reason === r ? '' : r)}
          />
        ))}
      </View>
      <TextField
        label="Or in your words"
        placeholder="Optional"
        value={reason}
        onChangeText={setReason}
        maxLength={200}
        error={reasonError}
      />
      {update.error ? <ThemedText themeColor="danger">{update.error.message}</ThemedText> : null}
      <Button
        label="Mark as lost"
        icon="close-circle-outline"
        variant="danger"
        disabled={!!reasonError}
        loading={update.isPending}
        onPress={() =>
          update.mutate(
            { enquiryId: enquiry.id, patch: { status: 'lost', lostReason: reason.trim() } },
            { onSuccess: onDone },
          )
        }
      />
    </View>
  );
}

function DeleteForm({ enquiry }: { enquiry: Enquiry }) {
  const remove = useDeleteEnquiry();
  return (
    <View style={styles.panel}>
      <ThemedText type="small" themeColor="textSecondary">
        Delete {enquiry.fullName}&apos;s enquiry and its timeline? To keep a record, mark it lost
        instead.
      </ThemedText>
      {remove.error ? <ThemedText themeColor="danger">{remove.error.message}</ThemedText> : null}
      <Button
        label="Delete for good"
        icon="trash-outline"
        variant="danger"
        loading={remove.isPending}
        onPress={() => remove.mutate(enquiry.id, { onSuccess: () => router.back() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  panel: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
