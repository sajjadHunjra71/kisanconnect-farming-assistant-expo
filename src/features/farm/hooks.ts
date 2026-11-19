import { useCallback, useEffect, useRef, useState } from 'react';

import { openRepos, type Repos } from '@/db';
import { useAuthStore } from '@/store/auth-store';
import { useDataVersion } from '@/store/data-version';

/** Repos for the current user: SQLite when signed in, sample data in demo mode / web. */
export function useRepos(): Repos | null {
  const key = useAuthStore((s) => (s.status === 'demo' ? 'sample' : s.status === 'signedIn' ? (s.session?.user.id ?? null) : null));
  const [repos, setRepos] = useState<Repos | null>(null);
  useEffect(() => {
    if (!key) {
      setRepos(null);
      return;
    }
    let alive = true;
    void openRepos(key === 'sample' ? null : key).then((r) => alive && setRepos(r));
    return () => {
      alive = false;
    };
  }, [key]);
  return repos;
}

/**
 * Run a repo query and re-run it after local writes and sync.
 * `deps` are the query's inputs (ids, filters).
 */
export function useRepoQuery<T>(query: (repos: Repos) => Promise<T>, deps: unknown[]) {
  const repos = useRepos();
  const version = useDataVersion((s) => s.version);
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({ data: undefined, loading: true, error: null });
  const queryRef = useRef(query);
  queryRef.current = query;

  const run = useCallback(() => {
    if (!repos) return () => undefined;
    let alive = true;
    queryRef
      .current(repos)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error: Error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, version, ...deps]);

  useEffect(run, [run]);
  return { ...state, repos, isSample: repos?.kind === 'sample' };
}
