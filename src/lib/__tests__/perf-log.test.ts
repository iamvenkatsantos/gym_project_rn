import { perfFetch, perfReport, requestName, resetPerfLog } from '@/lib/perf-log';

describe('requestName', () => {
  it.each([
    ['https://api.vinven.net/rest/v1/gym_people?select=*&gym_id=eq.123', 'rest/gym_people'],
    ['https://api.vinven.net/rest/v1/rpc/gym_attendance', 'rpc/gym_attendance'],
    ['https://api.vinven.net/auth/v1/token?grant_type=password', 'auth/token'],
    ['https://api.vinven.net/functions/v1/send-push', 'functions/send-push'],
    ['https://api.vinven.net/storage/v1/object/progress-photos/abc/def.jpg', 'storage'],
  ])('%s -> %s', (url, name) => {
    expect(requestName(url)).toBe(name);
  });

  it('never keeps a query value or an id', () => {
    const name = requestName(
      'https://api.vinven.net/rest/v1/workouts?id=eq.7a1c2f0e-1111-2222-3333-444455556666&email=a@b.c',
    );
    expect(name).toBe('rest/workouts');
    expect(name).not.toMatch(/7a1c2f0e|a@b\.c/);
  });
});

describe('perfFetch', () => {
  it('returns fetch itself when logging is off', () => {
    const base = jest.fn() as unknown as typeof fetch;
    expect(perfFetch(base, false)).toBe(base);
  });

  it('passes the response through and records name, size and time', async () => {
    resetPerfLog();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const response = new Response('x'.repeat(2048), { status: 200 });
    const base = (() => Promise.resolve(response)) as unknown as typeof fetch;
    const result = await perfFetch(base, true)('https://api.vinven.net/rest/v1/exercises?x=1');
    expect(result).toBe(response);
    expect(await result.text()).toHaveLength(2048);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(perfReport()).toMatch(/rest\/exercises: 1x, \d+ ms, 2 KB/);
    log.mockRestore();
  });

  it('reports only API names and numbers', () => {
    resetPerfLog();
    expect(perfReport()).not.toMatch(/https?:|eyJ/);
  });
});
