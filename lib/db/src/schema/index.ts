import { pgTable, text, bigint, serial, integer } from "drizzle-orm/pg-core";

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

// ─── V4 Token Registry (bonding curve, mainnet) ───────────────────────────────

export const tokenRecordsV4 = pgTable("token_records_v4", {
  address: text("address").primaryKey(),       // token address (lowercase)
  curveAddress: text("curve_address").notNull(),
  creator: text("creator").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  metadataURI: text("metadata_uri"),
  deployedAt: bigint("deployed_at", { mode: "number" }).notNull(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  ethUsdPrice8: text("eth_usd_price_8").notNull(),       // chainlink price at deploy
  virtualEthReserve: text("virtual_eth_reserve").notNull(), // wei
  graduated: integer("graduated").notNull().default(0),  // 0=no 1=yes
  cancelled: integer("cancelled").notNull().default(0),
  v2Pair: text("v2_pair"),
  realEth: text("real_eth").notNull().default("0"),      // wei (latest cache)
  tokensSold: text("tokens_sold").notNull().default("0"), // wei
  lastTradeAt: bigint("last_trade_at", { mode: "number" }),
  indexedAt: bigint("indexed_at", { mode: "number" }).notNull(),
  chainId: integer("chain_id").notNull().default(1),
});

export type TokenRecordV4Row = typeof tokenRecordsV4.$inferSelect;
export type TokenRecordV4Insert = typeof tokenRecordsV4.$inferInsert;

// ─── V4 Trades ────────────────────────────────────────────────────────────────

export const tradesV4 = pgTable("trades_v4", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address").notNull(),
  curveAddress: text("curve_address").notNull(),
  trader: text("trader").notNull(),
  type: text("type").notNull(),                  // "buy" | "sell"
  ethAmount: text("eth_amount").notNull(),       // wei (gross)
  fee: text("fee").notNull(),                    // wei (creator fee)
  tokenAmount: text("token_amount").notNull(),   // wei
  totalBondedAfter: text("total_bonded_after").notNull(), // wei (cum real eth after this trade)
  priceWeiPerToken: text("price_wei_per_token").notNull(), // computed (ethAmount / tokenAmount, after-fee for buy)
  txHash: text("tx_hash").notNull(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  logIndex: integer("log_index").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export type TradeV4Row = typeof tradesV4.$inferSelect;
export type TradeV4Insert = typeof tradesV4.$inferInsert;

// ─── V4 Token Holders ─────────────────────────────────────────────────────────

export const tokenHoldersV4 = pgTable("token_holders_v4", {
  // composite PK on (tokenAddress, holderAddress)
  tokenAddress: text("token_address").notNull(),
  holderAddress: text("holder_address").notNull(),
  balance: text("balance").notNull().default("0"), // wei, as text bigint
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (t) => ({
  pk: { columns: [t.tokenAddress, t.holderAddress], name: "token_holders_v4_pk" },
}));

export type TokenHolderV4Row = typeof tokenHoldersV4.$inferSelect;
export type TokenHolderV4Insert = typeof tokenHoldersV4.$inferInsert;

// ─── Indexer progress cursors ─────────────────────────────────────────────────

export const indexerCursors = pgTable("indexer_cursors", {
  id: text("id").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type IndexerCursorRow = typeof indexerCursors.$inferSelect;
