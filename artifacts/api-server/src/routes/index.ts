import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import proxyRouter from "./proxy.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/proxy", proxyRouter);
router.use("/settings", settingsRouter);

export default router;
