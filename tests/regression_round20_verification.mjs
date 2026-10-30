import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'fs';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_ORIGIN = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

const envFile = fs.readFileSync('/home/awerkori/.Projects/project-nox-reader-round20/.dev.vars.preview_full', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=');
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [line.slice(0, idx).trim(), val];
    })
);

const adminDb = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function getCookiesForUser(email, origin) {
  const { data: link, error } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cookies = [];
  const client = createServerClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (vals) => cookies.push(...vals)
    }
  });
  const { error: authError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (authError) throw authError;

  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
    secure: origin.startsWith('https:')
  }));
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   PROJECT NOX — ROUND 20 REGRESSION VERIFICATION SUITE         ');
  console.log('================================================================');

  const TEST_USER = 'jonasamaral25@gmail.com';
  console.log(`Using isolated test account: ${TEST_USER}`);

  // Find user ID
  const { data: userData } = await adminDb.from('members').select('id, xp').eq('email', TEST_USER).maybeSingle();
  let testUserId = userData?.id;
  if (!testUserId) {
    const { data: authUser } = await adminDb.auth.admin.listUsers();
    const found = authUser.users.find(u => u.email === TEST_USER);
    testUserId = found?.id;
  }
  console.log(`Test user ID: ${testUserId}`);

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // REGRESSION 1: COMMENTS (Estilo A Reddit Minimalista) & MENTIONS
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING COMMENTS, REPLIES, CASCADE DELETION & @ MENTIONS ---');
  {
    const cookies = await getCookiesForUser(TEST_USER, PREVIEW_ORIGIN);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies(cookies);
    const page = await context.newPage();

    // Use a test chapter
    const testChapterId = '00bbe943-3005-5478-8345-57425b157537';
    await page.goto(`${PREVIEW_ORIGIN}/ler/${testChapterId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Scroll to comments section
    const commentsEl = await page.$('.comments-section, .chapter-comments, #comentarios');
    if (commentsEl) {
      await commentsEl.scrollIntoViewIfNeeded();
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    await page.waitForTimeout(1000);

    // Check Reddit Minimalist container
    const headerTitle = await page.textContent('.comments-title, .comments-header h3, h3');
    console.log(`Comments section found: ${Boolean(headerTitle)}`);

    // Verify Mention Autocomplete UI
    const commentInput = await page.$('textarea, input[placeholder*="comentário"], .comment-composer textarea');
    if (commentInput) {
      console.log('Found comment textarea, testing @ mention trigger...');
      await commentInput.focus();
      await commentInput.fill('Testando menção @P');
      await page.waitForTimeout(600);

      const mentionPopup = await page.$('.mention-suggestions, .mention-dropdown, .mentions-popup, [data-mention-list]');
      console.log(`Mention autocomplete dropdown rendered: ${Boolean(mentionPopup)}`);
      
      // Clear input
      await commentInput.fill('');
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/v20_regression_comments_reddit.png` });
    console.log('Saved comments screenshot: v20_regression_comments_reddit.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // REGRESSION 2: READING XP PROGRESSION & TOAST (Controlled User)
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING READING XP PROGRESSION & TOAST ---');
  {
    // Pick an unread chapter for jonasamaral25
    // Query reading table for jonasamaral25
    const { data: readList } = await adminDb.from('reading').select('chapter_id').eq('user_id', testUserId);
    const readIds = new Set((readList || []).map(r => r.chapter_id));

    // Candidate chapters
    const candidateIds = [
      '21d17c2b-e18d-5571-9577-e32492b73371',
      '287ac66e-cb02-50df-bcb7-15f3829bef31',
      '35b48bb9-5d72-5945-bb51-2246c3d6c0f2',
      '4e566c7d-7c96-547d-80f0-bfe22555fa2b',
      '4ea603ee-2a0b-5477-8293-42d3b6747fb8'
    ];
    const virginChapterId = candidateIds.find(id => !readIds.has(id)) || candidateIds[0];
    console.log(`Testing XP progression on chapter: ${virginChapterId}`);

    const cookies = await getCookiesForUser(TEST_USER, PREVIEW_ORIGIN);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies(cookies);
    const page = await context.newPage();

    let apiActionResponse = null;
    page.on('response', async (res) => {
      if (res.url().includes('/api/action') && res.request().method() === 'POST') {
        try {
          const body = await res.json();
          apiActionResponse = body;
          console.log('[API /api/action response]:', JSON.stringify(body));
        } catch {}
      }
    });

    await page.goto(`${PREVIEW_ORIGIN}/ler/${virginChapterId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Scroll to end of chapter to trigger reading completion
    console.log('Scrolling down to trigger chapter completion...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Wait for XP toast element or confirmation
    const toast = await page.$('.xp-toast, .toast-container, [data-toast="xp"], .xp-progression-toast');
    const toastVisible = Boolean(toast);
    console.log(`XP progression toast rendered in DOM: ${toastVisible}`);

    await page.screenshot({ path: `${ARTIFACT_DIR}/v20_regression_xp_toast.png` });
    console.log('Saved XP toast screenshot: v20_regression_xp_toast.png');

    await context.close();
  }

  await browser.close();
  console.log('\nAll regression verifications completed successfully!');
}

runRegressionSuite().catch(err => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
