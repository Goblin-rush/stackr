import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uploadRouter from "./upload";
import metadataRouter from "./metadata";
import candlesRouter from "./candles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(metadataRouter);
router.use(candlesRouter);

export default router;
