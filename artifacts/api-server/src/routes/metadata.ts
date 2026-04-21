import { Router, type IRouter } from "express";
import { db, tokenMetadata } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

router.get("/tokens/:address/metadata", async (req, res) => {
  const addr = req.params.address;
  if (!ADDR_RE.test(addr)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const rows = await db
    .select()
    .from(tokenMetadata)
    .where(eq(tokenMetadata.address, addr.toLowerCase()))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.get("/tokens/metadata", async (_req, res) => {
  const rows = await db.select().from(tokenMetadata);
  const out: Record<string, typeof rows[number]> = {};
  for (const r of rows) out[r.address] = r;
  res.json(out);
});

router.post("/tokens/:address/metadata", async (req, res) => {
  const addr = req.params.address;
  if (!ADDR_RE.test(addr)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const safeStr = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    return t.slice(0, max);
  };

  const key = addr.toLowerCase();
  // Once-write: do not overwrite existing metadata (prevents hijack).
  const existing = await db
    .select({ address: tokenMetadata.address })
    .from(tokenMetadata)
    .where(eq(tokenMetadata.address, key))
    .limit(1);
  if (existing.length > 0) {
    res.json({ ok: true, skipped: true });
    return;
  }

  await db.insert(tokenMetadata).values({
    address: key,
    website: safeStr(body.website, 512),
    twitter: safeStr(body.twitter, 512),
    telegram: safeStr(body.telegram, 512),
    description: safeStr(body.description, 4096),
    image: safeStr(body.image, 512),
    createdAt: Date.now(),
  }).onConflictDoNothing();

  res.json({ ok: true });
});

export default router;
