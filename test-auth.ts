import { auth } from './src/lib/server/auth';
async function test() {
  const result = await auth.api.signInEmail({
    body: { email: 'a@a.com', password: 'password' },
    asResponse: true
  });
}
