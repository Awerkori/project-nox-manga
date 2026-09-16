import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import bcrypt from "bcryptjs";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
    }),
    emailAndPassword: {
        enabled: true,
        async hashPassword(password: string) {
            return await bcrypt.hash(password, 10);
        },
        async verifyPassword(password: string, hash: string) {
            return await bcrypt.compare(password, hash);
        },
    },
});
