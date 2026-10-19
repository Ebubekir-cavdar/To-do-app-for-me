import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend } from '../backend';
import type { NewTask, Task } from '../model/task';
import { withOptimisticDone, type OptimisticRepository } from './optimisticDone';
import type { AppUser, TaskRepository } from './types';

/**
 * The optimistic view of a repository (instant checkbox toggles and fail marks, see optimisticDone): one per
 * repository, so every hook shares its overlay, and a new user (new repository) starts clean.
 */
const views = new WeakMap<TaskRepository, OptimisticRepository>();
function view(repo: TaskRepository): OptimisticRepository {
  let v = views.get(repo);
  if (!v) {
    v = withOptimisticDone(repo);
    views.set(repo, v);
  }
  return v;
}

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface DataContextValue {
  mode: 'firebase' | 'local';
  status: AuthStatus;
  user: AppUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  repo: TaskRepository | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Auth re-emits the same user on token refreshes: keep the previous object then, so the context
  // value (and every useData() consumer) stays the same.
  useEffect(() => backend.onAuthChanged((u) => { setUser((prev) => (sameUser(prev, u) ? prev : u)); setStatus(u ? 'signedIn' : 'signedOut'); }), []);

  const uid = user?.uid;
  const repo = useMemo(() => (user ? backend.repository(user) : null), [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<DataContextValue>(
    () => ({ mode: backend.mode, status, user, signIn: backend.signIn, signOut: backend.signOut, repo }),
    [status, user, repo],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(DataContext);
  if (!v) throw new Error('useData must be used inside <DataProvider>');
  return v;
}

const NO_TASKS: Task[] = [];
const LOADING: { tasks: Task[]; loading: boolean } = { tasks: NO_TASKS, loading: true };

/**
 * Tasks within [fromYmd, toYmd]. `loading` is true until the first snapshot.
 * Identity is stable: the same `tasks` array (and returned object) until the data changes, and
 * unchanged Task objects are reused across snapshots (repositories guarantee that).
 */
export function useTasksInRange(fromYmd: string, toYmd: string): { tasks: Task[]; loading: boolean } {
  const { repo } = useData();
  // Tagged with repo + range so a previous user's or range's snapshot is never shown.
  const [state, setState] = useState<{ repo: TaskRepository; key: string; tasks: Task[] } | null>(null);
  const key = fromYmd + '|' + toYmd;
  useEffect(() => {
    if (!repo) return;
    return view(repo).subscribeRange(fromYmd, toYmd, (tasks) =>
      setState((prev) => (prev && prev.repo === repo && prev.key === key && prev.tasks === tasks ? prev : { repo, key, tasks })),
    );
  }, [repo, fromYmd, toYmd, key]);
  const tasks = state && state.repo === repo && state.key === key ? state.tasks : null;
  return useMemo(() => (tasks ? { tasks, loading: false } : LOADING), [tasks]);
}

/**
 * All not-done tasks (any date) and whether the first snapshot has arrived yet — the same
 * subscription as useOpenTasks (shared with it by the repository).
 */
export function useOpenTasksState(): { tasks: Task[]; loading: boolean } {
  const { repo } = useData();
  const [state, setState] = useState<{ repo: TaskRepository; tasks: Task[] } | null>(null);
  useEffect(
    () =>
      repo
        ? view(repo).subscribeOpen((tasks) => setState((prev) => (prev && prev.repo === repo && prev.tasks === tasks ? prev : { repo, tasks })))
        : undefined,
    [repo],
  );
  const tasks = state && state.repo === repo ? state.tasks : null;
  return useMemo(() => (tasks ? { tasks, loading: false } : LOADING), [tasks]);
}

/** All not-done tasks (any date, failed ones included) — filter with isOverdue() for the overdue summary. */
export function useOpenTasks(): Task[] {
  return useOpenTasksState().tasks;
}

const report = (e: unknown) => console.warn('[tasks] write failed', e);

/**
 * Fire-and-forget writes: subscriptions update immediately, even offline. Stable identity per repo.
 * setDone and setFailed are optimistic: every task hook shows the new value synchronously, in the
 * gesture's own render (reverted if the write fails).
 */
export function useTaskActions() {
  const { repo } = useData();
  const add = useCallback((input: NewTask) => { repo?.add(input).catch(report); }, [repo]);
  const setDone = useCallback((id: string, done: boolean) => { if (repo) view(repo).setDone(id, done).catch(report); }, [repo]);
  const setFailed = useCallback((id: string, failed: boolean) => { if (repo) view(repo).setFailed(id, failed).catch(report); }, [repo]);
  const remove = useCallback((id: string) => { repo?.remove(id).catch(report); }, [repo]);
  const addMany = useCallback((inputs: NewTask[]) => { repo?.addMany(inputs).catch(report); }, [repo]);
  const removeSeries = useCallback((recurrenceId: string, fromYmd: string) => { repo?.removeSeries(recurrenceId, fromYmd).catch(report); }, [repo]);
  return useMemo(
    () => ({ add, addMany, setDone, setFailed, remove, removeSeries }),
    [add, addMany, setDone, setFailed, remove, removeSeries],
  );
}

function sameUser(a: AppUser | null, b: AppUser | null): boolean {
  return a === b || (!!a && !!b && a.uid === b.uid && a.name === b.name && a.email === b.email && a.photoURL === b.photoURL);
}
