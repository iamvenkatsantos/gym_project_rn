import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { usePhones } from '@/features/members/hooks';
import { RenewalRow } from '@/features/memberships/components/renewal-row';
import { useRenewalsPage } from '@/features/memberships/hooks';
import type { Membership } from '@/features/memberships/types';
import { EXPIRING_SOON_DAYS, RECENTLY_ENDED_DAYS } from '@/features/memberships/rules';

/** Everyone to talk to about renewing, for owners and supervisors, a page at a time. */
export default function RenewalsScreen() {
  const gym = useActiveGym();
  // Only the due memberships, from the server, instead of every membership ever recorded.
  const endingSoon = useRenewalsPage(gym.gymId, 'endingSoon');
  const ended = useRenewalsPage(gym.gymId, 'ended');
  const shownSoon = endingSoon.data?.pages.flatMap((p) => p.memberships) ?? [];
  const shownEnded = ended.data?.pages.flatMap((p) => p.memberships) ?? [];
  // Mobile numbers for WhatsApp, just for the rows shown; the list still shows while they load.
  const phones = usePhones(
    gym.gymId,
    [...shownSoon, ...shownEnded].map((m) => m.memberId),
  ).data;

  const rows = (list: Membership[]) =>
    list.map((m) => (
      <RenewalRow
        key={m.id}
        gymId={gym.gymId}
        gymName={gym.gymName}
        membership={m}
        phone={phones?.get(m.memberId)}
      />
    ));

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Members get a push {EXPIRING_SOON_DAYS}, 3 and 1 days before their membership ends, on the
        last day and the day after. Tap Remind to send one now, or WhatsApp to message them
        yourself.
      </ThemedText>
      <QueryState
        query={endingSoon}
        isEmpty={(data) => data.pages[0].total === 0 && ended.data?.pages[0].total === 0}
        emptyText="No renewals due. Nobody's membership ends this week.">
        {(data) => {
          const soonTotal = data.pages[0].total;
          return (
            <>
              <SectionHeader title="Ending this week" detail={`${soonTotal}`} />
              {soonTotal === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nobody&apos;s membership ends this week.
                </ThemedText>
              ) : null}
              {rows(shownSoon)}
              <ShowMore query={endingSoon} loaded={shownSoon.length} total={soonTotal} />
            </>
          );
        }}
      </QueryState>
      <QueryState query={ended}>
        {(data) => {
          const endedTotal = data.pages[0].total;
          if (endedTotal === 0 && endingSoon.data?.pages[0].total === 0) return null;
          return (
            <>
              <SectionHeader
                title={`Ended in the last ${RECENTLY_ENDED_DAYS} days`}
                detail={`${endedTotal}`}
              />
              {endedTotal === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No memberships ended recently.
                </ThemedText>
              ) : null}
              {rows(shownEnded)}
              <ShowMore query={ended} loaded={shownEnded.length} total={endedTotal} />
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function ShowMore({
  query,
  loaded,
  total,
}: {
  query: ReturnType<typeof useRenewalsPage>;
  loaded: number;
  total: number;
}) {
  if (!query.hasNextPage) return null;
  return (
    <Button
      label={`Show more (${loaded} of ${total})`}
      variant="secondary"
      loading={query.isFetchingNextPage}
      onPress={() => query.fetchNextPage()}
    />
  );
}
