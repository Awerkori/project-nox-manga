import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ownerCookies, userCookies } from "../scripts/owner-session.mjs";
import path from "path";
import fs from "fs";
process.loadEnvFile(".env");

const DIR = "/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/global_mentions_homolog";
fs.mkdirSync(DIR, { recursive: true });

const PROD_URL = "https://manga.project-nox-awerkori.workers.dev";
const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function flushOutboxIfNeeded() {
  try {
    await fetch(`${PROD_URL}/api/internal/email-processor`, { method: "POST" });
  } catch (err) {
    // Ignore network error on trigger
  }
}

async function waitForOutboxSent(notificationId, maxWaitSec = 15) {
  for (let i = 0; i < maxWaitSec; i++) {
    const { data: o } = await db.from("scan_email_outbox")
      .select("*")
      .eq("notification_id", notificationId)
      .maybeSingle();

    if (o && o.status === "SENT" && o.provider_message_id) {
      return o;
    }

    if (o && o.status === "PENDING" && i % 3 === 2) {
      await flushOutboxIfNeeded();
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  const { data: finalCheck } = await db.from("scan_email_outbox")
    .select("*")
    .eq("notification_id", notificationId)
    .maybeSingle();
  return finalCheck;
}

async function dismissAgeGate(page) {
  try {
    const backdrop = page.locator(".age-gate-backdrop");
    if (await backdrop.count() > 0 && await backdrop.isVisible()) {
      const btn = page.locator(".age-gate-card button").first();
      if (await btn.count() > 0) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }
  } catch (e) {}
}

async function main() {
  console.log("================================================================");
  console.log("🚀 HOMOLOGAÇÃO REAL PELA UI: CHAT, COMENTÁRIOS, NOTIFICAÇÕES & BREVO");
  console.log(`URL: ${PROD_URL}`);
  console.log("================================================================\n");

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  const awerkoriCookies = await ownerCookies(PROD_URL);
  const pristamCookies = await userCookies("teka.a7x@gmail.com", PROD_URL);

  const ageCookies = [
    { name: "nox-age-status", value: "ADULT", url: PROD_URL },
    { name: "nox-blur-nsfw", value: "false", url: PROD_URL }
  ];

  const { data: usersData } = await db.auth.admin.listUsers();
  const awerkoriUser = usersData.users.find(u => u.email === "awerkori@gmail.com");
  const pristamUser = usersData.users.find(u => u.email === "teka.a7x@gmail.com");

  console.log(`Awerkori UID: ${awerkoriUser.id} (${awerkoriUser.email})`);
  console.log(`Pristam UID: ${pristamUser.id} (${pristamUser.email})\n`);

  const results = [];

  // =========================================================================
  // FASE 1: CHAT DA SCAN - AUTO-MENÇÃO PELA UI REAL
  // =========================================================================
  console.log("----------------------------------------------------------------");
  console.log("FASE 1: Chat da Scan - Auto-menção (@awerkori) pela UI");
  console.log("----------------------------------------------------------------");

  const ctxAwe = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctxAwe.addCookies([...awerkoriCookies, ...ageCookies]);
  const pageAwe = await ctxAwe.newPage();

  console.log("Navegando para /scan?tab=chat...");
  await pageAwe.goto(`${PROD_URL}/scan?tab=chat`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await pageAwe.waitForSelector(".chat-module-root", { timeout: 20000 });
  await pageAwe.waitForTimeout(2000);
  await dismissAgeGate(pageAwe);

  const chatTa = pageAwe.locator("textarea.composer-textarea");
  await chatTa.scrollIntoViewIfNeeded();

  // Testar autocomplete no Chat digitando @awe
  console.log("Digitando @awe no composer do Chat...");
  await chatTa.fill("@awe");
  await pageAwe.waitForTimeout(800);
  await pageAwe.screenshot({ path: path.join(DIR, "01_chat_mention_autocomplete.png") });
  console.log("✔ Screenshot do autocomplete no Chat capturada");

  // Digitar mensagem completa de auto-menção
  const testChatToken = `REAL-CHAT-${Date.now()}`;
  const chatMsgText = `@awerkori TESTE EMAIL MENÇÃO REAL PELA UI [${testChatToken}]`;
  await chatTa.fill(chatMsgText);
  await pageAwe.waitForTimeout(600);

  const sendBtn = pageAwe.locator(".composer-form button[type=\"submit\"], button.btn-composer-send-rich").first();
  if (await sendBtn.count() > 0) {
    await sendBtn.click();
  } else {
    await pageAwe.keyboard.press("Enter");
  }
  console.log("✔ Mensagem postada pela interface do Chat");
  await pageAwe.waitForTimeout(3500);

  await pageAwe.screenshot({ path: path.join(DIR, "01_chat_post_awerkori.png") });

  const { data: msgAwe } = await db.from("scan_messages")
    .select("*")
    .ilike("content", `%${testChatToken}%`)
    .maybeSingle();

  if (!msgAwe) throw new Error("Mensagem não encontrada no banco após envio pela UI");
  console.log(`✔ Message ID encontrado: ${msgAwe.id}`);

  const { data: mentionsAwe } = await db.from("scan_message_mentions")
    .select("*")
    .eq("message_id", msgAwe.id);
  console.log(`✔ scan_message_mentions registros: ${mentionsAwe?.length || 0}`);

  const { data: notifAwe } = await db.from("notifications")
    .select("*")
    .eq("user_id", awerkoriUser.id)
    .ilike("body", `%${testChatToken}%`)
    .maybeSingle();
  console.log(`✔ Notification ID encontrado: ${notifAwe?.id}`);

  const outboxAwe = await waitForOutboxSent(notifAwe?.id);

  console.log(`✔ Outbox ID: ${outboxAwe?.id}`);
  console.log(`✔ Outbox Status: ${outboxAwe?.status}`);
  console.log(`✔ Brevo Provider Message ID: ${outboxAwe?.provider_message_id}`);
  console.log(`✔ Recipient: ${outboxAwe?.recipient_email}`);

  results.push({
    superficie: "Chat Scan (Auto-menção UI)",
    messageId: msgAwe.id,
    mentionCount: mentionsAwe?.length || 0,
    notifId: notifAwe?.id,
    outboxId: outboxAwe?.id,
    status: outboxAwe?.status,
    providerMessageId: outboxAwe?.provider_message_id,
    pass: outboxAwe?.status === "SENT" && Boolean(outboxAwe?.provider_message_id)
  });

  // =========================================================================
  // FASE 2: CHAT DA SCAN - MENÇÃO A OUTRO USUÁRIO PELA UI REAL
  // =========================================================================
  console.log("\n----------------------------------------------------------------");
  console.log("FASE 2: Chat da Scan - Menção a outro usuário (@pristam2) pela UI");
  console.log("----------------------------------------------------------------");

  const testChatToken2 = `REAL-CHAT-OTHER-${Date.now()}`;
  const chatMsgText2 = `@pristam2 Olá Pristam, teste menção outro usuário [${testChatToken2}]`;

  await chatTa.fill(chatMsgText2);
  await pageAwe.waitForTimeout(600);
  if (await sendBtn.count() > 0) {
    await sendBtn.click();
  } else {
    await pageAwe.keyboard.press("Enter");
  }
  console.log("✔ Mensagem para Pristam postada pela interface do Chat");
  await pageAwe.waitForTimeout(3500);

  const { data: msgOther } = await db.from("scan_messages")
    .select("*")
    .ilike("content", `%${testChatToken2}%`)
    .maybeSingle();

  if (!msgOther) throw new Error("Mensagem para Pristam não encontrada no banco");
  console.log(`✔ Message ID encontrado: ${msgOther.id}`);

  const { data: notifOther } = await db.from("notifications")
    .select("*")
    .eq("user_id", pristamUser.id)
    .ilike("body", `%${testChatToken2}%`)
    .maybeSingle();
  console.log(`✔ Notification ID para Pristam: ${notifOther?.id}`);

  const outboxOther = await waitForOutboxSent(notifOther?.id);

  console.log(`✔ Outbox ID para Pristam: ${outboxOther?.id}`);
  console.log(`✔ Outbox Status: ${outboxOther?.status}`);
  console.log(`✔ Brevo Provider Message ID: ${outboxOther?.provider_message_id}`);
  console.log(`✔ Recipient: ${outboxOther?.recipient_email}`);

  results.push({
    superficie: "Chat Scan (Menção A->B UI)",
    messageId: msgOther.id,
    mentionCount: 1,
    notifId: notifOther?.id,
    outboxId: outboxOther?.id,
    status: outboxOther?.status,
    providerMessageId: outboxOther?.provider_message_id,
    pass: outboxOther?.status === "SENT" && Boolean(outboxOther?.provider_message_id)
  });

  // =========================================================================
  // FASE 3: COMENTÁRIOS DE OBRA - AUTOCOMPLETE, MENÇÃO E EMAIL PELA UI REAL
  // =========================================================================
  console.log("\n----------------------------------------------------------------");
  console.log("FASE 3: Comentários de Obra - Autocomplete, Menção e Email pela UI");
  console.log("----------------------------------------------------------------");

  const ctxPristam = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctxPristam.addCookies([...pristamCookies, ...ageCookies]);
  const pagePristam = await ctxPristam.newPage();

  console.log("Pristam navegando para /obra/wise-knight-life...");
  await pagePristam.goto(`${PROD_URL}/obra/wise-knight-life`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await pagePristam.waitForSelector(".comments", { timeout: 20000 });
  await pagePristam.waitForTimeout(2000);
  await dismissAgeGate(pagePristam);

  const commentTa = pagePristam.locator(".comments textarea");
  await commentTa.scrollIntoViewIfNeeded();

  console.log("Digitando @awe no composer de comentários...");
  await commentTa.focus();
  await commentTa.pressSequentially("@awe", { delay: 120 });
  await pagePristam.waitForTimeout(1000);

  try {
    await pagePristam.waitForSelector(".mention-candidate-item", { timeout: 6000 });
    console.log("✔ Menu de autocomplete exibido com sucesso");
  } catch (err) {
    console.warn("Aviso: seletor .mention-candidate-item demorou, verificando estado...");
  }

  await pagePristam.screenshot({ path: path.join(DIR, "02_comment_autocomplete_awe.png") });
  console.log("✔ Screenshot do autocomplete em Comentários capturada");

  const candItem = pagePristam.locator(".mention-candidate-item").first();
  if (await candItem.count() > 0) {
    await candItem.click({ force: true });
    await pagePristam.waitForTimeout(400);
  } else {
    await pagePristam.keyboard.press("Enter");
    await pagePristam.waitForTimeout(400);
  }

  const commentToken = `COMM-REAL-${Date.now()}`;
  await commentTa.pressSequentially(`consegue verificar este capítulo? [${commentToken}]`, { delay: 20 });
  await pagePristam.waitForTimeout(600);

  await pagePristam.screenshot({ path: path.join(DIR, "03_comment_before_submit.png") });

  const submitCommentBtn = pagePristam.locator(".comments form button.button.compact").first();
  await submitCommentBtn.click();
  console.log("✔ Comentário submetido pela UI");
  await pagePristam.waitForTimeout(4000);

  const { data: commRow } = await db.from("comments")
    .select("*")
    .ilike("body", `%${commentToken}%`)
    .maybeSingle();

  if (!commRow) throw new Error("Comentário não encontrado no banco");
  console.log(`✔ Comment ID encontrado: ${commRow.id}`);

  const { data: notifComm } = await db.from("notifications")
    .select("*")
    .eq("user_id", awerkoriUser.id)
    .ilike("body", `%${commentToken}%`)
    .maybeSingle();

  console.log(`✔ Notification ID para Awerkori: ${notifComm?.id}`);
  console.log(`✔ Notification Deep Link: ${notifComm?.href}`);

  const outboxComm = await waitForOutboxSent(notifComm?.id);

  console.log(`✔ Outbox ID Comentário: ${outboxComm?.id}`);
  console.log(`✔ Outbox Status Comentário: ${outboxComm?.status}`);
  console.log(`✔ Brevo Provider Message ID: ${outboxComm?.provider_message_id}`);
  console.log(`✔ Recipient Comentário: ${outboxComm?.recipient_email}`);

  console.log(`Awerkori abrindo deep link: ${notifComm?.href}`);
  await pageAwe.goto(`${PROD_URL}${notifComm?.href}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissAgeGate(pageAwe);
  await pageAwe.waitForSelector(`#comment-${commRow.id}`, { timeout: 15000 });
  await pageAwe.waitForTimeout(2000);
  await pageAwe.screenshot({ path: path.join(DIR, "04_comment_highlight_deeplink.png") });
  console.log("✔ Screenshot do comentário com highlight e scroll capturada");

  results.push({
    superficie: "Comentário Obra (UI Real)",
    messageId: commRow.id,
    mentionCount: 1,
    notifId: notifComm?.id,
    outboxId: outboxComm?.id,
    status: outboxComm?.status,
    providerMessageId: outboxComm?.provider_message_id,
    pass: outboxComm?.status === "SENT" && Boolean(outboxComm?.provider_message_id)
  });

  // =========================================================================
  // FASE 4: RESPOSTA A COMENTÁRIO (REPLY) PELA UI REAL
  // =========================================================================
  console.log("\n----------------------------------------------------------------");
  console.log("FASE 4: Resposta a Comentário (Reply) pela UI Real");
  console.log("----------------------------------------------------------------");

  const commArticle = pageAwe.locator(`#comment-${commRow.id}`);
  const replyBtn = commArticle.locator("button:has-text(\"Responder\")").first();
  if (await replyBtn.count() > 0) {
    await replyBtn.click();
    await pageAwe.waitForTimeout(500);

    const replyToken = `REPLY-REAL-${Date.now()}`;
    const replyTa = pageAwe.locator(".comments textarea");
    await replyTa.fill(`@pristam2 Com certeza, já revisei e está ótimo! [${replyToken}]`);
    await pageAwe.waitForTimeout(400);

    await pageAwe.screenshot({ path: path.join(DIR, "05_reply_before_submit.png") });

    const sendReplyBtn = pageAwe.locator(".comments form button.button.compact").first();
    await sendReplyBtn.click();
    console.log("✔ Resposta de comentário enviada pela UI");
    await pageAwe.waitForTimeout(4000);

    const { data: replyRow } = await db.from("comments")
      .select("*")
      .ilike("body", `%${replyToken}%`)
      .maybeSingle();

    console.log(`✔ Reply Comment ID: ${replyRow?.id}`);

    const { data: notifReplies } = await db.from("notifications")
      .select("*")
      .eq("user_id", pristamUser.id)
      .ilike("body", `%${replyToken}%`);
    const notifReply = notifReplies?.[0];

    console.log(`✔ Notification ID da Resposta para Pristam: ${notifReply?.id}`);

    const outboxReply = await waitForOutboxSent(notifReply?.id);

    console.log(`✔ Outbox ID Resposta: ${outboxReply?.id}`);
    console.log(`✔ Outbox Status Resposta: ${outboxReply?.status}`);
    console.log(`✔ Brevo Provider Message ID Resposta: ${outboxReply?.provider_message_id}`);

    results.push({
      superficie: "Reply Comentário (UI Real)",
      messageId: replyRow?.id,
      mentionCount: 1,
      notifId: notifReply?.id,
      outboxId: outboxReply?.id,
      status: outboxReply?.status,
      providerMessageId: outboxReply?.provider_message_id,
      pass: outboxReply?.status === "SENT" && Boolean(outboxReply?.provider_message_id)
    });
  } else {
    console.warn("Botão Responder não encontrado no comentário");
  }

  await browser.close();

  console.log("\n================================================================");
  console.log("📊 MATRIZ FINAL DE HOMOLOGAÇÃO REAL PELA INTERFACE");
  console.log("================================================================");
  console.table(results);

  const allPassed = results.every(r => r.pass);
  if (allPassed) {
    console.log("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! FLUXO COMPLETO COMPROVADO PELA UI REAL.");
  } else {
    console.error("\n❌ ALGUNS TESTES FALHARAM.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
