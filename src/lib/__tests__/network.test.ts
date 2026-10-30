import { friendlyFetch, OFFLINE_HINT, OFFLINE_MESSAGE, OFFLINE_TITLE } from '@/lib/network';

const failing = (error: unknown) => (() => Promise.reject(error)) as unknown as typeof fetch;

describe('friendlyFetch', () => {
  it('passes server replies through', async () => {
    const response = { ok: false, status: 400 } as Response;
    const ok = (() => Promise.resolve(response)) as unknown as typeof fetch;
    await expect(friendlyFetch(ok)('https://x')).resolves.toBe(response);
  });

  it('turns a connection reset into a short message', async () => {
    const cause = new Error('fetch failed: java.net.SocketException: Connection reset');
    const error = await friendlyFetch(failing(cause))('https://x').catch((e: unknown) => e);
    expect(error).toMatchObject({
      name: OFFLINE_TITLE,
      message: OFFLINE_HINT,
      msg: OFFLINE_MESSAGE,
      cause,
    });
    // PostgREST and storage show "name: message".
    const { name, message } = error as Error;
    expect(`${name}: ${message}`).toBe("Can't reach the server: Check your network and try again.");
  });

  it.each([
    Object.assign(new Error('aborted'), { name: 'AbortError' }),
    Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
  ])('keeps cancelled requests as they are', async (abort) => {
    await expect(friendlyFetch(failing(abort))('https://x')).rejects.toBe(abort);
  });
});
