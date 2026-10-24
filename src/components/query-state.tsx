import { type UseQueryResult } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';

type QueryStateProps<T> = {
  query: UseQueryResult<T>;
  emptyText?: string;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
};

/** Renders loading, error and empty states so screens only handle the happy path. */
export function QueryState<T>({ query, emptyText, isEmpty, children }: QueryStateProps<T>) {
  if (query.isPending) return <ActivityIndicator />;

  if (query.isError) {
    return (
      <Card>
        <ThemedText>Something went wrong: {query.error.message}</ThemedText>
        <Button label="Try again" variant="secondary" onPress={() => query.refetch()} />
      </Card>
    );
  }

  if (isEmpty?.(query.data)) {
    return <ThemedText themeColor="textSecondary">{emptyText ?? 'Nothing here yet.'}</ThemedText>;
  }

  return <>{children(query.data)}</>;
}
