import { coalesceOutbox, decisionOpId, type OutboxOp } from '../outbox-coalesce';

const op = (kind: OutboxOp['kind'], op_id: string, base_version = 3, payload: unknown = { kind }): OutboxOp => ({
  op_id,
  kind,
  payload,
  base_version,
});

describe('coalesceOutbox', () => {
  it('inserts when nothing is pending', () => {
    const d = coalesceOutbox(null, op('update', 'n'));
    expect(d).toEqual({ type: 'insert', entry: op('update', 'n') });
    expect(decisionOpId(d, null)).toBe('n');
  });

  it('create + update stays a create with the new payload', () => {
    const d = coalesceOutbox(op('create', 'p', 0), op('update', 'n', 0, { name: 'B' }));
    expect(d).toEqual({ type: 'replace', entry: { op_id: 'p', kind: 'create', base_version: 0, payload: { name: 'B' } } });
    expect(decisionOpId(d, null)).toBe('p');
  });

  it('create + delete drops both', () => {
    const pending = op('create', 'p', 0);
    const d = coalesceOutbox(pending, op('delete', 'n', 0));
    expect(d).toEqual({ type: 'drop', op_id: 'p' });
    expect(decisionOpId(d, pending)).toBeNull();
  });

  it('update + update replaces payload and keeps base_version', () => {
    const d = coalesceOutbox(op('update', 'p', 3), op('update', 'n', 7, { name: 'C' }));
    expect(d).toEqual({ type: 'replace', entry: { op_id: 'p', kind: 'update', base_version: 3, payload: { name: 'C' } } });
  });

  it('update + delete becomes a delete with the old base_version', () => {
    const d = coalesceOutbox(op('update', 'p', 3), op('delete', 'n', 3, { deleted_at: 'x' }));
    expect(d).toEqual({ type: 'replace', entry: { op_id: 'p', kind: 'delete', base_version: 3, payload: { deleted_at: 'x' } } });
  });

  it('nothing overrides a pending delete', () => {
    const pending = op('delete', 'p');
    const d = coalesceOutbox(pending, op('update', 'n'));
    expect(d).toEqual({ type: 'ignore' });
    expect(decisionOpId(d, pending)).toBe('p');
  });
});
