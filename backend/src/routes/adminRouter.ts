import { Router } from "express";
import { requireAdmin } from "../controllers/adminController";

const router = Router();



router.use(requireAdmin);


export default router;
