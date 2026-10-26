import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { EnquiryRow } from '@/features/enquiries/components/enquiry-row';
import { useEnquiries } from '@/features/enquiries/hooks';
import { conversion, countEnquiries, filterEnquiries } from '@/features/enquiries/rules';
import type { EnquiryFilter } from '@/features/enquiries/types';

const filters: { value: EnquiryFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'due', label: 'Due today' },
  { value: 'trial', label: 'On trial' },
  { value: 'joined', label: 'Joined' },
  { value: 'lost', label: 'Lost' },
  { value: 'all', label: 'All' },
];

/** The front desk's list of walk-ins and callers, for owners and supervisors. */
export default function EnquiriesScreen() {
  const gym = useActiveGym();
  const enquiries = useEnquiries(gym.gymId);
  const [filter, setFilter] = useState<EnquiryFilter>('open');
  const [query, setQuery] = useState('');
  const counts = enquiries.data ? countEnquiries(enquiries.data) : undefined;
  const month = enquiries.data ? conversion(enquiries.data) : undefined;

  return (
    <Screen>
      <Button
        label="Add an enquiry"
        icon="person-add-outline"
        onPress={() => router.push('/enquiry-editor')}
      />
      <View style={styles.grid}>
        <StatTile label="Follow-ups due" value={counts?.due} icon="call-outline" accent />
        <StatTile label="On trial" value={counts?.trial} icon="ticket-outline" />
        <StatTile label="Enquiries, 30 days" value={month?.enquiries} icon="chatbubbles-outline" />
        <StatTile
          label="Joined, 30 days"
          value={month && (month.rate === null ? '–' : `${month.joined} · ${month.rate}%`)}
          icon="trending-up-outline"
        />
      </View>

      <TextField
        label="Search"
        placeholder="Name, phone or interest"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        icon="search"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {filters.map((f) => (
          <Chip
            key={f.value}
            label={counts ? `${f.label} ${counts[f.value]}` : f.label}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </ScrollView>

      <QueryState
        query={enquiries}
        isEmpty={(list) => list.length === 0}
        emptyText="No enquiries yet. Add walk-ins and callers here so nobody slips through.">
        {(list) => {
          const shown = filterEnquiries(list, filter, query);
          return shown.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {query ? 'Nobody matches.' : 'Nothing here right now.'}
            </ThemedText>
          ) : (
            <Card>
              {shown.map((enquiry, i) => (
                <EnquiryRow
                  key={enquiry.id}
                  enquiry={enquiry}
                  divider={i > 0}
                  onPress={() =>
                    router.push({
                      pathname: '/enquiry/[enquiryId]',
                      params: { enquiryId: enquiry.id },
                    })
                  }
                />
              ))}
            </Card>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
  },
});
