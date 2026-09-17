import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import bcrypt from "bcryptjs";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
    secret: process.env.BETTER_AUTH_SECRET || "12345678901234567890123456789012",
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
