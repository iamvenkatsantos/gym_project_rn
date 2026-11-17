import { QueryClient } from '@tanstack/react-query';

import { createScreenQueries } from '@/lib/screen-queries';

function setup() {
  const client = new QueryClient();
  const screens = createScreenQueries(client.getQueryCache());
  const watch = (key: string) =>
    client.getQueryCache().build(client, { queryKey: [key], queryFn: async () => key });
  const observe = (key: string) => {
    const query = watch(key);
    const observer = { listeners: 0 } as never;
    query.addObserver({ ...(observer as object), onQueryUpdate() {}, options: {} } as never);
    return query;
  };
  return { screens, observe };
}

describe('screen queries', () => {
  it('refreshes a screen\'s own queries but not another screen\'s', () => {
    const { screens, observe } = setup();
    screens.setFocused('people');
    const people = observe('people');
    screens.setFocused('payments');
    const payments = observe('payments');
    expect(screens.isFor('payments', payments)).toBe(true);
    expect(screens.isFor('payments', people)).toBe(false);
    expect(screens.isFor('people', people)).toBe(true);
  });

  it('lets every screen refresh a query no screen owns', () => {
    const { screens, observe } = setup();
    const tabBar = observe('badge');
    screens.setFocused('payments');
    expect(screens.isFor('payments', tabBar)).toBe(true);
  });

  it('shares a query two screens both use', () => {
    const { screens, observe } = setup();
    screens.setFocused('home');
    observe('plans');
    screens.setFocused('payments');
    const plans = observe('plans');
    expect(screens.isFor('home', plans)).toBe(true);
    expect(screens.isFor('payments', plans)).toBe(true);
  });

  it('forgets a screen that closes', () => {
    const { screens, observe } = setup();
    screens.setFocused('person');
    const query = observe('person-data');
    screens.forget('person');
    // Owned by no live screen, but once owned: nobody refreshes it except a screen that adds it again.
    expect(screens.isFor('payments', query)).toBe(false);
  });
});
