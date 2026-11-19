/**
 * Repo logic shared by the SQLite and in-memory stores (no React Native imports).
 * Every write = row change + outbox entry in ONE transaction, coalesced so a row
 * has at most one pending op.
 */
import { coalesceOutbox, decisionOpId } from './outbox-coalesce';
import type { Row, Store, TxStore } from './store';
import type {
  ActivitiesRepo,
  ActivityInput,
  ActivityRecord,
  CropInput,
  CropRecord,
  CropsRepo,
  FarmInput,
  FarmRecord,
  FarmsRepo,
  ListOptions,
  Repo,
  SyncTable,
} from './types';
import { ValidationError, cropAcres, farmAcres, validateActivity, validateCrop, validateFarm } from './validate';

export class NotFoundError extends Error {
  constructor(table: string, id: string) {
    super(`${table} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export type RepoContext = {
  userId: string;
  newId: () => string;
  now?: () => string;
};

/** Columns the server generates; never sent in a payload. */
const SERVER_GENERATED = ['area_acres'];

type Spec<I> = {
  table: SyncTable;
  /** Validate input and return the stored fields (incl. derived ones like area_acres). */
  build(input: I): Record<string, unknown>;
  /** Fields copied from the existing row on update (can't move a crop to another farm). */
  fixed: string[];
  /** Throw if a referenced parent is missing, deleted, or mismatched. */
  checkParents?(tx: TxStore, fields: Record<string, unknown>, userId: string): Promise<void>;
  children: { table: SyncTable; fk: 'farm_id' | 'crop_id' }[];
};

async function liveParent(tx: TxStore, table: SyncTable, id: string, userId: string, field: string): Promise<Row> {
  const row = await tx.getRow(table, id);
  if (!row || row.user_id !== userId) throw new ValidationError(field, 'not found');
  if (row.deleted_at) throw new ValidationError(field, 'was deleted');
  return row;
}

function createRepo<R, I>(store: Store, spec: Spec<I>, ctx: RepoContext): Repo<R, I> {
  const now = ctx.now ?? (() => new Date().toISOString());

  async function enqueue(tx: TxStore, row: Row, kind: 'create' | 'update' | 'delete') {
    const pending = await tx.getPendingOp(spec.table, row.id);
    const decision = coalesceOutbox(pending, {
      op_id: ctx.newId(),
      kind,
      payload: null,
      base_version: Number(row.version ?? 0),
    });
    row.last_op_id = decisionOpId(decision, pending) ?? row.last_op_id ?? null;
    if (decision.type === 'insert' || decision.type === 'replace') {
      const payload: Record<string, unknown> = { ...row };
      for (const k of SERVER_GENERATED) delete payload[k];
      decision.entry.payload = payload;
    }
    await tx.putRow(spec.table, row);
    await tx.applyDecision(spec.table, row.id, decision);
  }

  async function getLive(tx: TxStore, id: string): Promise<Row> {
    const row = await tx.getRow(spec.table, id);
    if (!row || row.user_id !== ctx.userId || row.deleted_at) throw new NotFoundError(spec.table, id);
    return row;
  }

  return {
    list: (options: ListOptions = {}) =>
      store.transaction(async (tx) => {
        const rows = await tx.listRows(spec.table, { user_id: ctx.userId, farm_id: options.farmId, crop_id: options.cropId });
        return rows
          .filter((r) => options.includeDeleted || !r.deleted_at)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) as R[];
      }),

    get: (id) =>
      store.transaction(async (tx) => {
        const row = await tx.getRow(spec.table, id);
        return row && row.user_id === ctx.userId && !row.deleted_at ? (row as R) : null;
      }),

    create: (input) =>
      store.transaction(async (tx) => {
        const fields = spec.build(input);
        await spec.checkParents?.(tx, fields, ctx.userId);
        const ts = now();
        const row: Row = {
          id: ctx.newId(),
          user_id: ctx.userId,
          ...fields,
          version: 0,
          last_op_id: null,
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        };
        await enqueue(tx, row, 'create');
        return row as R;
      }),

    update: (id, patch) =>
      store.transaction(async (tx) => {
        const existing = await getLive(tx, id);
        const merged: Record<string, unknown> = { ...existing, ...patch };
        for (const k of spec.fixed) merged[k] = existing[k];
        const fields = spec.build(merged as I);
        await spec.checkParents?.(tx, fields, ctx.userId);
        const row: Row = { ...existing, ...fields, updated_at: now() };
        await enqueue(tx, row, 'update');
        return row as R;
      }),

    remove: (id) =>
      store.transaction(async (tx) => {
        const existing = await tx.getRow(spec.table, id);
        if (!existing || existing.user_id !== ctx.userId || existing.deleted_at) return;
        const ts = now();
        await enqueue(tx, { ...existing, deleted_at: ts, updated_at: ts }, 'delete');
        // The server soft-deletes children itself, so children get no outbox entry;
        // any unsent child edits are dropped.
        for (const child of spec.children) {
          const rows = await tx.listRows(child.table, { user_id: ctx.userId, [child.fk]: id });
          const live = rows.filter((r) => !r.deleted_at);
          for (const r of live) await tx.putRow(child.table, { ...r, deleted_at: ts, updated_at: ts });
          await tx.dropPending(child.table, live.map((r) => r.id));
        }
      }),
  };
}

export function createRepos(store: Store, ctx: RepoContext) {
  const farmsRepo: FarmsRepo = createRepo<FarmRecord, FarmInput>(
    store,
    {
      table: 'farms',
      build: (input) => {
        const f = validateFarm(input);
        return { ...f, area_acres: farmAcres(f) };
      },
      fixed: [],
      children: [
        { table: 'crops', fk: 'farm_id' },
        { table: 'activities', fk: 'farm_id' },
      ],
    },
    ctx,
  );

  const cropsRepo: CropsRepo = createRepo<CropRecord, CropInput>(
    store,
    {
      table: 'crops',
      build: (input) => {
        const c = validateCrop(input);
        return { ...c, area_acres: cropAcres(c) };
      },
      fixed: ['farm_id'],
      checkParents: async (tx, f, userId) => {
        await liveParent(tx, 'farms', String(f.farm_id), userId, 'farm_id');
      },
      children: [{ table: 'activities', fk: 'crop_id' }],
    },
    ctx,
  );

  const activitiesRepo: ActivitiesRepo = createRepo<ActivityRecord, ActivityInput>(
    store,
    {
      table: 'activities',
      build: (input) => ({ ...validateActivity(input) }),
      fixed: ['farm_id'],
      checkParents: async (tx, f, userId) => {
        await liveParent(tx, 'farms', String(f.farm_id), userId, 'farm_id');
        if (f.crop_id) {
          const crop = await liveParent(tx, 'crops', String(f.crop_id), userId, 'crop_id');
          if (crop.farm_id !== f.farm_id) throw new ValidationError('crop_id', 'is on another farm');
        }
      },
      children: [],
    },
    ctx,
  );

  return { farmsRepo, cropsRepo, activitiesRepo };
}
