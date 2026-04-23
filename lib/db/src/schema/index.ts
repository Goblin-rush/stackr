import { pgTable, text, bigint, serial, integer } from "drizzle-orm/pg-core";

// ─── V3 Token Registry ────────────────────────────────────────────────────────

export const tokenRecordsV3 = pgTable("token_records_v3", {
  address: text("address").primaryKey(),
  creator: text("creator").notNull(),
  deployedAt: bigint("deployed_at", { mode: "number" }).notNull(),
  metadataURI: text("metadata_uri"),
  indexedAt: bigint("indexed_at", { mode: "number" }).notNull(),
  blockNumber: bigint("block_number", { mode: "number" }),
});

export type TokenRecordV3Row = typeof tokenRecordsV3.$inferSelect;
export type TokenRecordV3Insert = typeof tokenRecordsV3.$inferInsert;

export const tokenMetadata = pgTable("token_metadata", {
  address: text("address").primaryKey(),
  website: text("website"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  description: text("description"),
  image: text("image"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type TokenMetadataRow = typeof tokenMetadata.$inferSelect;
export type TokenMetadataInsert = typeof tokenMetadata.$inferInsert;

// ─── Trade indexer ────────────────────────────────────────────────────────────

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address").notNull(),
  curveAddress: text("curve_address").notNull(),
  trader: text("trader").notNull(),
  type: text("type").notNull(), // "buy" | "sell"
  ethAmount: text("eth_amount").notNull(),       // wei, stored as text
  ethForPrice: text("eth_for_price").notNull(),  // wei (ethForCurve on buy, ethOutGross on sell)
  tokenAmount: text("token_amount").notNull(),   // wei
  progressBps: integer("progress_bps").notNull(),
  txHash: text("tx_hash").notNull(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  logIndex: integer("log_index").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export type TradeRow = typeof trades.$inferSelect;
export type TradeInsert = typeof trades.$inferInsert;

// ─── Indexer progress cursors ─────────────────────────────────────────────────

export const indexerCursors = pgTable("indexer_cursors", {
  id: text("id").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type IndexerCursorRow = typeof indexerCursors.$inferSelect;
