import { Router, type IRouter } from "express";
import multer from "multer";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      cb(new Error("Only PNG, JPEG, GIF, WEBP or SVG images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const PINATA_BASE = "https://api.pinata.cloud";
const GATEWAY = "https://gateway.pinata.cloud/ipfs";

router.post("/upload-image", upload.single("file"), async (req, res) => {
  const jwt = process.env.JWT;
  if (!jwt) {
    res.status(500).json({ error: "Pinata JWT not configured on server" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Missing file field" });
    return;
  }

  try {
    const fd = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    fd.append("file", blob, req.file.originalname || "upload");
    fd.append(
      "pinataMetadata",
      JSON.stringify({ name: req.file.originalname || "token-image" }),
    );
    fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const r = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });

    if (!r.ok) {
      const text = await r.text();
      res.status(502).json({ error: "Pinata upload failed", details: text });
      return;
    }

    const data = (await r.json()) as { IpfsHash: string };
    const cid = data.IpfsHash;
    res.json({
      cid,
      url: `ipfs://${cid}`,
      gatewayUrl: `${GATEWAY}/${cid}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
