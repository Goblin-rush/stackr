import { pgTable, text, bigint } from "drizzle-orm/pg-core";

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
