import { db } from "../db/index";
import { eq } from "drizzle-orm";
import { users, type UserRole } from "../db/schema";
import { clerkClient } from "@clerk/express";
import { parseRole } from "./roles";

export async function getLocalUser(clerkUserId: string) {
	const [row] = await db
		.select()
		.from(users)
		.where(eq(users.clerkUserId, clerkUserId))
		.limit(1);
	return row ?? null;
}

/**
 * Returns the local user row. If it doesn't exist yet (webhook hasn't fired),
 * fetches from Clerk API and upserts into the DB on the fly.
 */
export async function getOrCreateLocalUser(clerkUserId: string) {
	const existing = await getLocalUser(clerkUserId);
	if (existing) return existing;

	const clerkUser = await clerkClient.users.getUser(clerkUserId);

	const email =
		clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
			?.emailAddress ?? "";
	const displayName =
		[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
	const role: UserRole = parseRole(clerkUser.publicMetadata?.role);

	const [row] = await db
		.insert(users)
		.values({
			clerkUserId: clerkUser.id,
			email,
			displayName,
			role,
		})
		.onConflictDoUpdate({
			target: users.clerkUserId,
			set: { email, displayName, role, updatedAt: new Date() },
		})
		.returning();

	return row;
}
