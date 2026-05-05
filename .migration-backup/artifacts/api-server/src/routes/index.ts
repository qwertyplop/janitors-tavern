import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import proxyRouter from "./proxy.js";
import settingsRouter from "./settings.js";
import authRouter from "./auth.js";
import storageRouter from "./storage.js";
import logsRouter from "./logs.js";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/proxy", proxyRouter);
router.use("/settings", requireAuth, settingsRouter);
router.use("/storage", requireAuth, storageRouter);
router.use("/logs", requireAuth, logsRouter);

export default router;
