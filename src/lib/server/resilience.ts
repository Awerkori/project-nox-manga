/**
 * Safe execution with timeout and fallback for external dependencies (Supabase, Telegram, etc.)
 */

export type QueryStatus = 'SUCCESS' | 'SUCCESS_EMPTY' | 'TIMEOUT' | 'ERROR';

export type SafeQueryResult<T> = {
  data: T | null;
  error: any | null;
  status: QueryStatus;
  isDegraded: boolean;
};

export async function safeDbQuery<T>(
  queryPromise: PromiseLike<{ data: T | null; error?: any }>,
  ms: number,
  operation: string,
  dependency: string = 'SUPABASE'
): Promise<SafeQueryResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<SafeQueryResult<T>>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[TIMEOUT] dependency=${dependency} operation=${operation} timeout_ms=${ms}`);
      resolve({
        data: null,
        error: new Error(`Dependency timeout after ${ms}ms`),
        status: 'TIMEOUT',
        isDegraded: true
      });
    }, ms);
  });

  try {
    const wrappedPromise = Promise.resolve(queryPromise).then((res): SafeQueryResult<T> => {
      if (res?.error) {
        console.warn(`[ERROR] dependency=${dependency} operation=${operation} error=${res.error?.message || res.error}`);
        return {
          data: null,
          error: res.error as any,
          status: 'ERROR',
          isDegraded: true
        };
      }
      const isEmpty = Array.isArray(res?.data) ? res.data.length === 0 : res?.data === null;
      return {
        data: (res?.data ?? null) as T,
        error: null,
        status: isEmpty ? 'SUCCESS_EMPTY' : 'SUCCESS',
        isDegraded: false
      };
    });

    return await Promise.race([wrappedPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[EXCEPTION] dependency=${dependency} operation=${operation} error=${err?.message || err}`);
    return {
      data: null,
      error: err,
      status: 'ERROR',
      isDegraded: true
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  fallback: T,
  operation: string,
  dependency: string = 'SUPABASE'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[TIMEOUT] dependency=${dependency} operation=${operation} timeout_ms=${ms}`);
      resolve(fallback);
    }, ms);
  });
  try {
    const result = await Promise.race([Promise.resolve(promise), timeoutPromise]);
    return result;
  } catch (err: any) {
    console.warn(`[ERROR] dependency=${dependency} operation=${operation} error=${err?.message || err}`);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
