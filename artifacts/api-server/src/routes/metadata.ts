import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";

const router: IRouter = Router();

const DATA_FILE = path.resolve(process.cwd(), "data", "metadata.json");

interface TokenMeta {
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  image?: string;
  createdAt: number;
}

let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<Record<string, TokenMeta>> {
  try {
    const txt = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, TokenMeta>): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), "utf8");
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

router.get("/tokens/:address/metadata", async (req, res) => {
  const addr = req.params.address;
  if (!ADDR_RE.test(addr)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const all = await readAll();
  const meta = all[addr.toLowerCase()];
  if (!meta) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(meta);
});

router.get("/tokens/metadata", async (_req, res) => {
  const all = await readAll();
  res.json(all);
});

router.post("/tokens/:address/metadata", async (req, res) => {
  const addr = req.params.address;
  if (!ADDR_RE.test(addr)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const body = req.body as Partial<TokenMeta>;
  const safeStr = (v: unknown, max = 2048): string | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t) return undefined;
    return t.slice(0, max);
  };
  const meta: TokenMeta = {
    website: safeStr(body.website, 512),
    twitter: safeStr(body.twitter, 512),
    telegram: safeStr(body.telegram, 512),
    description: safeStr(body.description, 4096),
    image: safeStr(body.image, 512),
    createdAt: Date.now(),
  };

  writeQueue = writeQueue
    .then(async () => {
      const all = await readAll();
      const key = addr.toLowerCase();
      const existing = all[key];
      // Once-write: if metadata already exists, do not overwrite (prevents hijack).
      // Edits would require signature gating which we'll add later.
      if (existing) return;
      all[key] = meta;
      await writeAll(all);
    })
    .catch(() => {});

  await writeQueue;
  res.json({ ok: true });
});

export default router;
