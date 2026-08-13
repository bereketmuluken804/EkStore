import { Router } from "express";
import { listProducts, getCategories, getProductBySlug } from "../controllers/productController";
const router = Router();

router.get("/", listProducts);
router.get("/categories", getCategories);
router.get("/:slug", getProductBySlug); // comes at the end cause :slug takes category if it come first

export default router;
