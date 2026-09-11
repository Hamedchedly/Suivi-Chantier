// ────────────────────────────────────────────────────────────────────────────
// Date commitments — the promises companies make about when a task will finish.
//
// Three dates coexist for every task and must never overwrite each other:
//   · baseline_end (contractual)  — signed, frozen, lives on the GanttTask
//   · planned_end                 — the current planning, lives on the GanttTask
//   · promised end                — what the company announced, recorded HERE,
//                                   once per visit/réunion, kept as a history.
//
// Keeping promises in their own append-only log is what lets a later visit show
// "promis le 09/09 : 20/09 — non tenu" instead of silently losing the engagement.
// Pure module: persistence lives in repo.ts.
// ────────────────────────────────────────────────────────────────────────────

export interface DateCommitment {
  id: string
  taskId: string
  lotId: string
  company?: string
  promisedEnd: string   // ISO yyyy-mm-dd — the date the company committed to
  at: string            // ISO datetime — when the commitment was recorded
  visitId: string
  visitDate: string     // ISO yyyy-mm-dd — the session it was taken in
}

/** Commitments for one task, most recent first. */
export function commitmentsForTask(all: DateCommitment[], taskId: string): DateCommitment[] {
  return all.filter(c => c.taskId === taskId).sort((a, b) => b.at.localeCompare(a.at))
}

/** The latest promise made for a task, if any. */
export function latestCommitment(all: DateCommitment[], taskId: string): DateCommitment | undefined {
  return commitmentsForTask(all, taskId)[0]
}

/**
 * A promise is broken once the task is planned to finish later than promised.
 * Comparison is on ISO yyyy-mm-dd strings, which sort chronologically.
 */
export function isBroken(commitment: DateCommitment, plannedEnd: string): boolean {
  return plannedEnd > commitment.promisedEnd
}

/** Drop every commitment recorded by a given visit (used when re-opening one). */
export function withoutVisit(all: DateCommitment[], visitId: string): DateCommitment[] {
  return all.filter(c => c.visitId !== visitId)
}
