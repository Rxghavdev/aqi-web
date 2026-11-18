/**
 * Share one in-flight promise per key, so a burst of identical requests makes a
 * single upstream call. The entry is removed as soon as the promise settles,
 * so a failure is never cached here (callers cache negatives themselves).
 */
export class SingleFlight<K, V> {
  private readonly pending = new Map<K, Promise<V>>();

  get size(): number {
    return this.pending.size;
  }

  has(key: K): boolean {
    return this.pending.has(key);
  }

  run(key: K, work: () => Promise<V>): Promise<V> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    let promise: Promise<V>;
    try {
      promise = work();
    } catch (error) {
      return Promise.reject(error);
    }
    const tracked = promise.finally(() => {
      if (this.pending.get(key) === tracked) this.pending.delete(key);
    });
    this.pending.set(key, tracked);
    return tracked;
  }
}

/**
 * Resolve with the promise's value, or `fallback` if it has not settled within
 * `ms` or it rejects. The promise keeps running, so a slow upstream still fills
 * its cache for the next request; only this caller stops waiting.
 */
export function withDeadline<T, F>(
  promise: Promise<T>,
  ms: number,
  fallback: F,
): Promise<T | F> {
  return new Promise<T | F>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
