/** A task on one calendar day. Same shape as the HTML prototypes (designs/SPEC.md). */
export interface Task {
  id: string;
  title: string;
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Optional local time, `HH:MM`. */
  time: string | null;
  done: boolean;
  /**
   * Marked as failed (long-press): a task that could only be done on its day and wasn't.
   * Invariant: failed ⇒ !done. Firestore: optional field, a document without it reads as false.
   */
  failed: boolean;
  /** Epoch ms; orders untimed tasks within a day. */
  createdAt: number;
  /** Reserved for categories (colored marks) — always null for now, preserve if present. */
  categoryId: string | null;
  /** Reserved for recurring tasks (every day for a month, every Monday…) — always null for now. */
  recurrenceId: string | null;
}

export interface NewTask {
  title: string;
  date: string;
  time: string | null;
  /** Set for every task created by one "Ferman" (recurring add); shared by the whole series. */
  recurrenceId?: string | null;
}
