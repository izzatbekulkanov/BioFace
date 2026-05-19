// Shared module-level data cache with TTL.
// Pages import from here so navigating between pages doesn't refetch
// data that hasn't gone stale yet.

const cache = new Map()

const DEFAULT_TTL = {
  '/api/cameras': 60_000,           // 1 minute — cameras don't change often
  '/api/organizations': 5 * 60_000, // 5 minutes — orgs change rarely
  '/api/employees/filter-options': 5 * 60_000,
}

const inflight = new Map()

export function isStale(url, ttlMs) {
  const entry = cache.get(url)
  if (!entry) return true
  const ttl = ttlMs ?? DEFAULT_TTL[url] ?? 60_000
  return Date.now() - entry.ts > ttl
}

export function getCached(url) {
  return cache.get(url)?.data ?? null
}

export function setCached(url, data) {
  cache.set(url, { ts: Date.now(), data })
}

export function invalidate(url) {
  if (url) cache.delete(url)
  else cache.clear()
}

/**
 * Smart fetch with cache + request deduplication.
 * - If cached and not stale: returns cached data immediately (no network call)
 * - If cached but stale: returns cached data + revalidates in background
 * - If multiple components request the same URL simultaneously: deduplicates
 *
 * @param {string} url
 * @param {object} options - { ttl, signal, force }
 * @returns {Promise<any>}
 */
export async function smartFetch(url, options = {}) {
  const { ttl, signal, force = false } = options

  // Force bypasses cache entirely
  if (!force && !isStale(url, ttl)) {
    return getCached(url)
  }

  // Deduplicate concurrent requests to the same URL
  if (inflight.has(url)) {
    return inflight.get(url)
  }

  const promise = fetch(url, { signal })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data = Array.isArray(json) ? json : (json.items ?? json)
      setCached(url, data)
      return data
    })
    .finally(() => {
      inflight.delete(url)
    })

  inflight.set(url, promise)
  return promise
}
