import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uploadRouter from "./upload";
import metadataRouter from "./metadata";
import tokensV4Router from "./tokens-v4";
import tradesV4Router from "./trades-v4";
import holdersV4Router from "./holders-v4";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(metadataRouter);
router.use(tokensV4Router);
router.use(tradesV4Router);
router.use(holdersV4Router);

export default router;
