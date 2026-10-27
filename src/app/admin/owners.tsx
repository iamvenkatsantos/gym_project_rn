import { router } from 'expo-router';

import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAdminBranches, useBillingSettings } from '@/features/branches/hooks';
import { ownerAccounts } from '@/features/branches/rules';
import { formatAmount } from '@/lib/format';

const branchCount = (n: number) => `${n} branch${n === 1 ? '' : 'es'}`;

/** Every gym owner, with their brands, branch count and monthly amount. Tap one to visit. */
export default function AdminOwnersScreen() {
  const branches = useAdminBranches();
  const settings = useBillingSettings();

  return (
    <Screen>
      <QueryState query={settings}>
        {(billing) => (
          <QueryState
            query={branches}
            isEmpty={(list) => ownerAccounts(list, billing).length === 0}
            emptyText="No owners yet. Invite one from a gym: Invite → Owner → A new gym.">
            {(list) => (
              <>
                <ListGroup>
                  {ownerAccounts(list, billing).map((account, i) => (
                    <ListRow
                      key={account.owner.id}
                      divider={i > 0}
                      icon="person-outline"
                      label={account.owner.fullName || account.owner.email}
                      detail={`${account.brands.map((b) => b.brandName).join(', ')} · ${branchCount(account.branches)}`}
                      trailing={
                        <Pill
                          label={`${formatAmount(account.monthlyCents, billing.currency)}/mo`}
                          tone="accent"
                        />
                      }
                      onPress={() =>
                        router.push({
                          pathname: '/admin-owner/[ownerId]',
                          params: { ownerId: account.owner.id },
                        })
                      }
                    />
                  ))}
                </ListGroup>
                <ThemedText type="small" themeColor="textSecondary">
                  Only owners are listed here. Members, trainers and supervisors belong to each gym.
                </ThemedText>
              </>
            )}
          </QueryState>
        )}
      </QueryState>
    </Screen>
  );
}
