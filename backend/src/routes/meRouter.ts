import { getAuth, clerkClient } from "@clerk/express";
import { Router } from "express";
import { getLocalUser } from "../lib/users";
import { parseRole } from "../lib/roles";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let user = await getLocalUser(userId);

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email =
        clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? "";
      const displayName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

      user = {
        id: clerkUser.id,
        clerkUserId: clerkUser.id,
        email,
        displayName,
        role: parseRole(clerkUser.publicMetadata?.role),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json({ user });
  } catch (e) {
    next(e);
  }
});
export default router;