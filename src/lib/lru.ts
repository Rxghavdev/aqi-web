/**
 * A small bounded cache: least-recently-used eviction plus a per-entry TTL.
 *
 * Every in-memory cache in this app keys on something a visitor can influence
 * (coordinates, slugs, query text), so none of them may grow without a limit.
 * `Map` keeps insertion order, so re-inserting on read keeps the oldest-used
 * entry first and eviction is O(1).
 */

export type LruOptions = {
  /** Most entries kept. Inserting past this evicts the least recently used. */
  max: number;
  /** Entry lifetime in milliseconds. Omit for no expiry. */
  ttlMs?: number;
  /** Clock, replaceable in tests. */
  now?: () => number;
};

type Entry<V> = { value: V; expiresAt: number };

export class LruCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: LruOptions) {
    if (!Number.isInteger(options.max) || options.max < 1) {
      throw new RangeError("LruCache max must be a positive integer");
    }
    this.max = options.max;
    this.ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.map.size;
  }

  /** The value, or undefined when missing or expired. Marks it recently used. */
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Like `get`, without changing recency. */
  peek(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt <= this.now()) return undefined;
    return entry.value;
  }

  has(key: K): boolean {
    return this.peek(key) !== undefined;
  }

  set(key: K, value: V, ttlMs: number = this.ttlMs): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + ttlMs });
    if (this.map.size > this.max) this.evict();
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  /** Drop expired entries first, then the least recently used, down to `max`. */
  private evict(): void {
    if (this.map.size <= this.max) return;
    const at = this.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= at) this.map.delete(key);
    }
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }
}
