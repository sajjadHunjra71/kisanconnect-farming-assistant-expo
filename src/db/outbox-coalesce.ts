/**
 * Outbox coalescing (pure). Before a write is queued we look at the row's
 * PENDING entry (not yet sent) and merge, so one row has at most one pending op:
 *
 *   pending  + incoming  → result
 *   none     + any       → insert incoming
 *   create   + update    → replace payload, still a create (base 0)
 *   create   + delete    → drop the pending create; the server never sees the row
 *   update   + update    → replace payload, keep base_version
 *   update   + delete    → becomes a delete, keep base_version
 *   delete   + any       → ignore (delete is final)
 *
 * The kept entry's op_id doesn't change, so the row's last_op_id stays in step.
 */

export type OutboxKind = 'create' | 'update' | 'delete';

export type OutboxOp = {
  op_id: string;
  kind: OutboxKind;
  payload: unknown;
  base_version: number;
};

export type CoalesceDecision =
  | { type: 'insert'; entry: OutboxOp }
  | { type: 'replace'; entry: OutboxOp }
  | { type: 'drop'; op_id: string }
  | { type: 'ignore' };

export function coalesceOutbox(pending: OutboxOp | null, incoming: OutboxOp): CoalesceDecision {
  if (!pending) return { type: 'insert', entry: incoming };

  switch (pending.kind) {
    case 'delete':
      return { type: 'ignore' };
    case 'create':
      if (incoming.kind === 'delete') return { type: 'drop', op_id: pending.op_id };
      return { type: 'replace', entry: { ...pending, payload: incoming.payload } };
    case 'update':
      return {
        type: 'replace',
        entry: { ...pending, kind: incoming.kind === 'delete' ? 'delete' : 'update', payload: incoming.payload },
      };
  }
}

/** The op_id a row should carry in last_op_id after the decision (null when nothing is queued). */
export function decisionOpId(decision: CoalesceDecision, pending: OutboxOp | null): string | null {
  switch (decision.type) {
    case 'insert':
    case 'replace':
      return decision.entry.op_id;
    case 'drop':
      return null;
    case 'ignore':
      return pending?.op_id ?? null;
  }
}
