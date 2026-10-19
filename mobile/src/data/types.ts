import type { NewTask, Task } from '../model/task';

/**
 * Storage contract shared by every backend (Firestore on the phone, local storage
 * on web preview / tests). The UI talks only to this interface.
 *
 * Rules every implementation must follow:
 * - Subscriptions fire immediately with current data, then on every change —
 *   including the caller's own writes, right away (optimistic, offline-first).
 *   So the UI never awaits a write before re-rendering.
 * - Write promises may resolve late (e.g. when the server acks) or never while
 *   offline; callers fire-and-forget and only log errors.
 */
export interface TaskRepository {
  /** Tasks whose date is within [fromYmd, toYmd] inclusive. Returns unsubscribe. */
  subscribeRange(fromYmd: string, toYmd: string, cb: (tasks: Task[]) => void): () => void;
  /**
   * All tasks that are not done (any date) — used for the overdue summary. Failed tasks are
   * included (they are not done): consumers filter them out where needed. Returns unsubscribe.
   */
  subscribeOpen(cb: (tasks: Task[]) => void): () => void;
  add(input: NewTask): Promise<Task>;
  /**
   * Adds several tasks at once (a recurring series) — atomically where the backend
   * supports it (Firestore writeBatch), all-or-nothing. Returns the created tasks
   * immediately, like add(). Inputs are validated like add(); an invalid input rejects
   * the whole call and writes nothing. Max 200 inputs.
   */
  addMany(inputs: NewTask[]): Promise<Task[]>;
  /** done=true also clears `failed` (one atomic update); done=false leaves `failed` as it is. */
  setDone(id: string, done: boolean): Promise<void>;
  /** failed=true also sets done=false (one atomic update); failed=false just clears it. */
  setFailed(id: string, failed: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  /**
   * Deletes every task of a recurring series whose date is >= fromYmd (done or not),
   * atomically where supported. Earlier tasks of the series are kept. Resolves with
   * the number of deleted tasks. Uses only a single-field query on recurrenceId.
   */
  removeSeries(recurrenceId: string, fromYmd: string): Promise<number>;
}

export type SignInErrorCode = 'cancelled' | 'in-progress' | 'network' | 'config' | 'play-services' | 'account-disabled' | 'unknown';

/** The `code` of an error rejected by `Backend.signIn()`, or 'unknown'. */
export function signInErrorCode(e: unknown): SignInErrorCode {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && ['cancelled', 'in-progress', 'network', 'config', 'play-services', 'account-disabled'].includes(code)
    ? (code as SignInErrorCode)
    : 'unknown';
}

export interface AppUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
}

/**
 * Platform backend. `src/backend/index.native.ts` (Firebase) is used on Android;
 * `src/backend/index.ts` (local, no login) on web and in tests.
 */
export interface Backend {
  mode: 'firebase' | 'local';
  /** Fires with the current user (or null) immediately, then on every change. Returns unsubscribe. */
  onAuthChanged(cb: (user: AppUser | null) => void): () => void;
  /**
   * Google sign-in. Rejects with an Error whose message is user-presentable Turkish text
   * and whose `code` is one of: cancelled | in-progress | network | config | play-services |
   * account-disabled | unknown. `code === 'cancelled'` means the user closed the account
   * picker — the UI should ignore it silently (see `signInErrorCode`).
   */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Repository scoped to one user's tasks. */
  repository(user: AppUser): TaskRepository;
}
