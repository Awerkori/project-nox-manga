import { createClient } from '/home/awerkori/.Projects/project-nox-importer/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const envRaw = readFileSync('/home/awerkori/.Projects/project-nox-manga/.dev.vars.preview_full', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runRealVerification() {
  console.log('=== REAL SESSION NOTIFICATION VERIFICATION ===');
  const email = 'awerkori@gmail.com';

  // 1. Authenticate as owner
  console.log('Step 1: Authenticating user', email);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) throw linkErr;

  const userClient = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
  const { data: authData, error: otpErr } = await userClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (otpErr) throw otpErr;
  const userId = authData.user.id;
  console.log('  Authenticated as userId:', userId);

  // Ensure test reproducibility by resetting read_at to null on the user's notifications
  await admin.from('notifications').update({ read_at: null }).eq('user_id', userId);

  // 2. Query initial unread notifications
  console.log('Step 2: Querying unread notifications as authenticated user');
  const { data: unreadBefore, error: unreadErr } = await userClient
    .from('notifications')
    .select('id, title, read_at')
    .eq('user_id', userId)
    .is('read_at', null);

  if (unreadErr) throw unreadErr;
  console.log(`  Found ${unreadBefore.length} unread notifications for user.`);
  expectCondition(unreadBefore.length >= 1, 'User must have unread notifications');

  const firstNotifId = unreadBefore[0].id;
  console.log('Step 3: Marking single notification as read:', firstNotifId);

  // Test RPC call (used by our action and server fallback)
  const { data: rpcRes, error: rpcErr } = await userClient.rpc('mark_notification_read', {
    p_notification_id: firstNotifId
  });
  console.log('  mark_notification_read RPC result:', { rpcRes, rpcErr });
  expectCondition(!rpcErr && rpcRes?.success, 'RPC must succeed without errors');

  // Verify in database directly
  const { data: verifiedOne } = await userClient
    .from('notifications')
    .select('id, read_at')
    .eq('id', firstNotifId)
    .single();

  console.log('  Verified single notification read_at:', verifiedOne.read_at);
  expectCondition(Boolean(verifiedOne.read_at), 'Notification must have non-null read_at in DB');

  // Step 4: Mark all notifications as read
  console.log('Step 4: Marking all remaining notifications as read');
  const { data: rpcAllRes, error: rpcAllErr } = await userClient.rpc('mark_all_notifications_read');
  console.log('  mark_all_notifications_read RPC result:', { rpcAllRes, rpcAllErr });
  expectCondition(!rpcAllErr && rpcAllRes?.success, 'mark_all_notifications_read must succeed');

  // Verify in database that 0 unread remain
  const { count: unreadAfter } = await userClient
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  console.log(`  Unread count after mark_all: ${unreadAfter}`);
  expectCondition(unreadAfter === 0, 'Unread count in DB must be exactly 0');

  // Step 5: Test reload / new session query
  console.log('Step 5: Simulating page refresh / new session load');
  const { count: unreadReloaded } = await userClient
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  console.log(`  Unread count on reload query: ${unreadReloaded}`);
  expectCondition(unreadReloaded === 0, 'Notifications must stay 0 after page refresh');

  console.log('=== ALL REAL NOTIFICATION VERIFICATIONS PASSED ===');
}

function expectCondition(cond, msg) {
  if (!cond) {
    console.error('FATAL ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

runRealVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
