import { auth } from './src/lib/server/auth';
import { db, schema } from './src/lib/server/db/index';

async function testRealAuth() {
  console.log("Fetching a real migrated user...");
  // Assuming Better Auth uses the `user` table
  const user = await db.query.user.findFirst({ where: (u, { isNotNull }) => isNotNull(u.hashedPassword) });
  if (!user) {
    console.log("No migrated user with password found.");
    return;
  }
  console.log("Found user:", user.email);
  
  // Try to login via Better Auth API directly
  try {
    const res = await auth.api.signInEmail({
      body: { email: user.email, password: 'password123' }, // we don't know the real password, so it should fail gracefully
      asResponse: false,
      headers: new Headers()
    });
    console.log("Login result:", res);
  } catch (e) {
    console.log("Login gracefully failed (expected for wrong password):", e.message);
  }
}
testRealAuth();
