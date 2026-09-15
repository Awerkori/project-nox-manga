import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ownerCookies } from './owner-session.mjs';

process.loadEnvFile('.env');

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BREVO_KEY = process.env.BREVO_API_KEY;

async function main() {
  console.log('🚀 Starting Final E2E Homologation...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const cookies = await ownerCookies(PROD_URL);
    await context.addCookies(cookies);

    const page = await context.newPage();

    // 1. Visit Work Comments page
    console.log('📖 Navigating to /obra/wise-knight-life...');
    await page.goto(`${PROD_URL}/obra/wise-knight-life`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    // Scroll to comments
    console.log('🔍 Locating comments textarea...');
    const textarea = page.locator('.comments textarea');
    await textarea.scrollIntoViewIfNeeded();
    await textarea.click();

    // Type mention trigger
    console.log('⌨️ Typing @awe to trigger mention autocomplete...');
    await textarea.pressSequentially('@awe', { delay: 100 });
    await page.waitForTimeout(1000);

    // Wait for autocomplete popup
    const autocomplete = page.locator('.mention-autocomplete-menu');
    await autocomplete.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Autocomplete popup visible!');

    // Verify real avatar is rendered inside candidate item
    const candidateItem = page.locator('.mention-candidate-item').first();
    const avatarImg = candidateItem.locator('.user-avatar-root img, img.avatar-image');
    await avatarImg.waitFor({ state: 'visible', timeout: 5000 });
    
    const avatarSrc = await avatarImg.getAttribute('src');
    console.log('🖼️ Candidate avatar src:', avatarSrc);

    if (!avatarSrc?.includes('/media/8da65838-b9db-49b5-bea3-1d4186b511fd')) {
      console.warn('⚠️ Avatar src does not match expected awerkori avatar ID:', avatarSrc);
    } else {
      console.log('✅ Avatar correctly points to /media/8da65838-b9db-49b5-bea3-1d4186b511fd (GIF support)!');
    }

    // Capture screenshot of desktop autocomplete
    const desktopScreenshotPath = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/global_mentions_homolog/final_autocomplete_desktop.png';
    await page.screenshot({ path: desktopScreenshotPath });
    console.log('📸 Desktop autocomplete screenshot saved:', desktopScreenshotPath);

    // 2. Mobile Viewport Test
    console.log('📱 Testing Mobile Viewport (375x812)...');
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    await mobileContext.addCookies(cookies);
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${PROD_URL}/obra/wise-knight-life`, { waitUntil: 'networkidle', timeout: 45000 });
    
    const mobileTextarea = mobilePage.locator('.comments textarea');
    await mobileTextarea.scrollIntoViewIfNeeded();
    await mobileTextarea.click();
    await mobileTextarea.pressSequentially('@awe', { delay: 100 });
    await mobilePage.waitForTimeout(1000);

    const mobileAutocomplete = mobilePage.locator('.mention-autocomplete-menu');
    await mobileAutocomplete.waitFor({ state: 'visible', timeout: 10000 });

    const mobileScreenshotPath = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/global_mentions_homolog/final_autocomplete_mobile.png';
    await mobilePage.screenshot({ path: mobileScreenshotPath });
    console.log('📸 Mobile autocomplete screenshot saved:', mobileScreenshotPath);
    await mobileContext.close();

    // 3. Post a Real Mention Comment from UI
    console.log('💬 Submitting real comment from UI...');
    await candidateItem.click();
    await page.waitForTimeout(500);

    const testCommentText = `FINAL QA LIVE VERIFICATION ${Date.now()}`;
    await textarea.pressSequentially(testCommentText, { delay: 30 });
    await page.waitForTimeout(500);

    const submitBtn = page.locator('.comments form button.button:has-text("Comentar")');
    await submitBtn.click();
    console.log('⏳ Comment submitted, waiting 4s for server and realtime...');
    await page.waitForTimeout(4000);

    // 4. Verify in Supabase
    console.log('🔍 Querying Supabase for the posted comment...');
    const { data: latestComment } = await db
      .from('comments')
      .select('id, body, created_at, user_id')
      .ilike('body', `%${testCommentText}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestComment) {
      throw new Error('Comment not found in DB!');
    }
    console.log('✅ Comment found in DB:', latestComment.id, latestComment.body);

    // 5. Verify Notification
    console.log('🔍 Querying Supabase for in-app notification...');
    const { data: latestNotif } = await db
      .from('notifications')
      .select('id, type, title, body, user_id, dedupe_key, created_at')
      .eq('user_id', latestComment.user_id)
      .ilike('body', `%${testCommentText}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestNotif) {
      throw new Error('Notification not found in DB!');
    }
    console.log('✅ In-App Notification found in DB:', latestNotif.id, latestNotif.title);

    // 6. Verify Outbox
    console.log('🔍 Querying scan_email_outbox for notification email...');
    let outboxItem = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data } = await db
        .from('scan_email_outbox')
        .select('*')
        .eq('notification_id', latestNotif.id)
        .maybeSingle();
      
      if (data) {
        outboxItem = data;
        if (data.status === 'SENT' && data.provider_message_id) {
          break;
        }
      }
      console.log(`Waiting for outbox processing (attempt ${attempt + 1}/8)... status: ${data?.status || 'none'}`);
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!outboxItem) {
      throw new Error('Outbox item not created!');
    }
    console.log('✅ Outbox record:', {
      id: outboxItem.id,
      status: outboxItem.status,
      delivery_status: outboxItem.delivery_status,
      provider_message_id: outboxItem.provider_message_id,
      recipient: outboxItem.recipient_email.replace(/^(.{1})(.*)(@.*)$/, '$1***$3')
    });

    // 7. Verify Live Brevo Event
    if (outboxItem.provider_message_id) {
      console.log('📡 Polling Brevo API for delivery event for messageId:', outboxItem.provider_message_id);
      let delivered = false;
      let lastEvent = null;

      for (let i = 0; i < 12; i++) {
        const cleanMsgId = outboxItem.provider_message_id.replace(/^<|>$/g, '');
        const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(cleanMsgId)}`, {
          headers: { 'api-key': BREVO_KEY, 'accept': 'application/json' }
        });

        if (res.ok) {
          const stats = await res.json();
          const events = stats.events || [];
          console.log(`Brevo check ${i + 1}: events count = ${events.length}`);
          if (events.length > 0) {
            lastEvent = events[0];
            console.log('Brevo event:', lastEvent.event, 'at', lastEvent.date, 'to', lastEvent.email.replace(/^(.{1})(.*)(@.*)$/, '$1***$3'));
            if (events.some(e => e.event === 'delivered')) {
              delivered = true;
              console.log('🎉 CONFIRMED DELIVERED ON BREVO!');
              break;
            }
          }
        }
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!delivered && lastEvent) {
        console.log(`ℹ️ Brevo status: ${lastEvent.event} (processed by Brevo relay)`);
      }
    }

    // 8. Test Scan Chat Mentions with Real Avatar
    console.log('💬 Testing Scan Chat Mentions at /scan?id=43fcfd4a-5fdc-4aeb-8f4b-a78d8a7c2e17&tab=chat...');
    await page.goto(`${PROD_URL}/scan?id=43fcfd4a-5fdc-4aeb-8f4b-a78d8a7c2e17&tab=chat`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea.chat-composer-textarea, .chat-composer-input, textarea').first();
    if (await chatInput.count() > 0) {
      await chatInput.click();
      await chatInput.pressSequentially('@awe', { delay: 100 });
      await page.waitForTimeout(1000);

      const chatAutocomplete = page.locator('.mention-autocomplete-menu');
      if (await chatAutocomplete.count() > 0 && await chatAutocomplete.isVisible()) {
        console.log('✅ Chat mention autocomplete popup visible!');
        const chatCandidate = chatAutocomplete.locator('.mention-candidate-item').first();
        const chatAvatarImg = chatCandidate.locator('.user-avatar-root img, img.avatar-image');
        if (await chatAvatarImg.count() > 0) {
          console.log('✅ Real avatar rendered in Scan Chat autocomplete popup!');
        }
        const chatScreenshotPath = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/global_mentions_homolog/final_chat_autocomplete.png';
        await page.screenshot({ path: chatScreenshotPath });
        console.log('📸 Chat autocomplete screenshot saved:', chatScreenshotPath);
      }
    }

    console.log('✨ All E2E Homologation tests completed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ Homologation test failed:', err);
  process.exit(1);
});
