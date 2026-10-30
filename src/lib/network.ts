export const OFFLINE_TITLE = "Can't reach the server";
export const OFFLINE_HINT = 'Check your network and try again.';
export const OFFLINE_MESSAGE = `${OFFLINE_TITLE}. ${OFFLINE_HINT}`;

/** True when the request was cancelled on purpose; those errors must pass through unchanged. */
function isAbort(error: unknown): boolean {
  const e = error as { name?: string; code?: string } | null;
  return e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.code === 'ABORT_ERR';
}

/**
 * The error thrown when a request never reaches Supabase (no signal, a mobile network
 * resetting the connection). supabase-js builds its message from different fields:
 * auth reads `msg`, PostgREST and storage show `${name}: ${message}`. These fields make
 * both read as a short sentence instead of "fetch failed: java.net.SocketException".
 */
export function offlineError(cause: unknown): Error {
  const error = new Error(OFFLINE_HINT, { cause });
  error.name = OFFLINE_TITLE;
  return Object.assign(error, { msg: OFFLINE_MESSAGE });
}

/** Wraps fetch so network failures throw `offlineError`. Server replies are untouched. */
export function friendlyFetch(baseFetch?: typeof fetch): typeof fetch {
  return async (input, init) => {
    try {
      return await (baseFetch ?? fetch)(input, init);
    } catch (error) {
      if (isAbort(error)) throw error;
      throw offlineError(error);
    }
  };
}
