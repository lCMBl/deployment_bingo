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
import { PlayerInvite } from "./player_invite_type";
import { EventContext, Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `player_invite`.
 *
 * Obtain a handle from the [`playerInvite`] property on [`RemoteTables`],
 * like `ctx.db.playerInvite`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.playerInvite.on_insert(...)`.
 */
export class PlayerInviteTableHandle {
  tableCache: TableCache<PlayerInvite>;

  constructor(tableCache: TableCache<PlayerInvite>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<PlayerInvite> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `id` unique index on the table `player_invite`,
   * which allows point queries on the field of the same name
   * via the [`PlayerInviteIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.playerInvite.id().find(...)`.
   *
   * Get a handle on the `id` unique index on the table `player_invite`.
   */
  id = {
    // Find the subscribed row whose `id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: number): PlayerInvite | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.id, col_val)) {
          return row;
        }
      }
    },
  };
  /**
   * Access to the `token` unique index on the table `player_invite`,
   * which allows point queries on the field of the same name
   * via the [`PlayerInviteTokenUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.playerInvite.token().find(...)`.
   *
   * Get a handle on the `token` unique index on the table `player_invite`.
   */
  token = {
    // Find the subscribed row whose `token` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: string): PlayerInvite | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.token, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: PlayerInvite) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: PlayerInvite) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: PlayerInvite) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: PlayerInvite) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: PlayerInvite, newRow: PlayerInvite) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: PlayerInvite, newRow: PlayerInvite) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
