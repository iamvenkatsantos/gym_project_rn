import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { usePeople } from '@/features/members/hooks';
import { RenewalRow } from '@/features/memberships/components/renewal-row';
import { useMemberships } from '@/features/memberships/hooks';
import {
  EXPIRING_SOON_DAYS,
  groupRenewals,
  RECENTLY_ENDED_DAYS,
  renewalsDue,
} from '@/features/memberships/rules';

/** Everyone to talk to about renewing, for owners and supervisors. */
export default function RenewalsScreen() {
  const gym = useActiveGym();
  const memberships = useMemberships(gym.gymId);
  // Mobile numbers for WhatsApp; the list still shows while they load.
  const people = usePeople(gym.gymId);
  const phones = new Map((people.data ?? []).map((p) => [p.id, p.phone]));

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Members get a push {EXPIRING_SOON_DAYS}, 3 and 1 days before their membership ends, on the
        last day and the day after. Tap Remind to send one now, or WhatsApp to message them
        yourself.
      </ThemedText>
      <QueryState
        query={memberships}
        isEmpty={(list) => renewalsDue(list).length === 0}
        emptyText="No renewals due. Nobody's membership ends this week.">
        {(list) => {
          const { endingSoon, ended } = groupRenewals(list);
          return (
            <>
              <SectionHeader title="Ending this week" detail={`${endingSoon.length}`} />
              {endingSoon.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nobody&apos;s membership ends this week.
                </ThemedText>
              ) : null}
              {endingSoon.map((m) => (
                <RenewalRow
                  key={m.id}
                  gymId={gym.gymId}
                  gymName={gym.gymName}
                  membership={m}
                  phone={phones.get(m.memberId)}
                />
              ))}
              <SectionHeader
                title={`Ended in the last ${RECENTLY_ENDED_DAYS} days`}
                detail={`${ended.length}`}
              />
              {ended.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No memberships ended recently.
                </ThemedText>
              ) : null}
              {ended.map((m) => (
                <RenewalRow
                  key={m.id}
                  gymId={gym.gymId}
                  gymName={gym.gymName}
                  membership={m}
                  phone={phones.get(m.memberId)}
                />
              ))}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}
