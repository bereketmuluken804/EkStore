import { getAuth } from "@clerk/express";
import { Router } from "express";
import { getOrCreateLocalUser } from "../lib/users";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getOrCreateLocalUser(userId);
    if (!user) {
      res.status(500).json({ error: "Failed to sync account" });
      return;
    }

    res.json({ user });
  } catch (e) {
    next(e);
  }
});
export default router;