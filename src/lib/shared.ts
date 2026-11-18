/**
 * Process-wide singletons.
 *
 * The bundler may emit pages and route handlers as separate module graphs, so
 * a plain module-level variable can end up duplicated: one snapshot copy, one
 * rate-limit budget, one refresh status per graph. Keeping state on
 * `globalThis` under a namespaced key gives every graph the same instance, and
 * lets it survive hot reloads in development.
 */
type Registry = Map<string, unknown>;

const REGISTRY = Symbol.for("hawa.shared");

export function shared<T>(key: string, init: () => T): T {
  const holder = globalThis as unknown as Record<symbol, Registry | undefined>;
  const registry = (holder[REGISTRY] ??= new Map<string, unknown>());
  if (!registry.has(key)) registry.set(key, init());
  return registry.get(key) as T;
}
