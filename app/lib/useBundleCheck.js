'use client';
import { useState, useEffect } from 'react';

// SimulationMaps bundle check — calls the hub endpoint to see if the
// signed-in user's email is a bundle holder. Cached per email (5 min).
const BUNDLE_CHECK_URL = 'https://www.simulationmaps.com/api/check-bundle';
const BUNDLE_CACHE_TTL = 5 * 60 * 1000;
const bundleCache = new Map();

export function useBundleCheck(email) {
  const [state, setState] = useState({ active: false, plan: null, loading: false });

  useEffect(() => {
    if (!email) {
      setState({ active: false, plan: null, loading: false });
      return;
    }

    const key = email.toLowerCase().trim();
    const cached = bundleCache.get(key);
    if (cached && Date.now() - cached.timestamp < BUNDLE_CACHE_TTL) {
      setState({ active: cached.active, plan: cached.plan, loading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    fetch(`${BUNDLE_CHECK_URL}?email=${encodeURIComponent(email)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Bundle check failed');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        bundleCache.set(key, {
          active: !!data.active,
          plan: data.plan || null,
          timestamp: Date.now(),
        });
        setState({ active: !!data.active, plan: data.plan || null, loading: false });
      })
      .catch((err) => {
        console.error('Bundle check error:', err);
        if (!cancelled) {
          setState({ active: false, plan: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  return state;
}
