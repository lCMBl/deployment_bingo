// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
import { RemoveExpiredVotesTimer } from "./remove_expired_votes_timer_type";
import { EventContext, Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `remove_expired_votes_timer`.
 *
 * Obtain a handle from the [`removeExpiredVotesTimer`] property on [`RemoteTables`],
 * like `ctx.db.removeExpiredVotesTimer`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.removeExpiredVotesTimer.on_insert(...)`.
 */
export class RemoveExpiredVotesTimerTableHandle {
  tableCache: TableCache<RemoveExpiredVotesTimer>;

  constructor(tableCache: TableCache<RemoveExpiredVotesTimer>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<RemoveExpiredVotesTimer> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `scheduled_id` unique index on the table `remove_expired_votes_timer`,
   * which allows point queries on the field of the same name
   * via the [`RemoveExpiredVotesTimerScheduledIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.removeExpiredVotesTimer.scheduled_id().find(...)`.
   *
   * Get a handle on the `scheduled_id` unique index on the table `remove_expired_votes_timer`.
   */
  scheduled_id = {
    // Find the subscribed row whose `scheduled_id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: bigint): RemoveExpiredVotesTimer | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.scheduled_id, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: RemoveExpiredVotesTimer, newRow: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: RemoveExpiredVotesTimer, newRow: RemoveExpiredVotesTimer) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
