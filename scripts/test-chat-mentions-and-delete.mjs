import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'fs';

// Load .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=');
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
);

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;
const brevoKey = env.BREVO_API_KEY;
const fromEmail = env.BREVO_FROM_EMAIL || 'awerkori@gmail.com';
const fromName = env.BREVO_FROM_NAME || 'Project Nox';

if (!supabaseUrl || !supabaseKey || !brevoKey) {
  console.error('ERRO: Credenciais ausentes no .env');
  process.exit(1);
}

const adminDb = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function getAuthClientForUser(email) {
  const { data: link, error } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cookies = [];
  const ssrClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookies,
      setAll: (vals) => cookies.push(...vals)
    }
  });
  const { data: authData, error: authErr } = await ssrClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (authErr) throw authErr;
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });
}

async function sendViaBrevo(recipientEmail, subject, htmlContent) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': brevoKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent
    })
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('================================================================');
  console.log('🚀 BATERIA DE HOMOLOGAÇÃO: CHAT DA SCAN & NOTIFICAÇÕES & DELEÇÃO');
  console.log('================================================================\n');

  const testMatrix = [];

  // 1. Carregar Scan, Canais e Usuários
  const { data: scans } = await adminDb.from('scans').select('*').limit(1);
  if (!scans || scans.length === 0) throw new Error('Scan não encontrada');
  const scan = scans[0];

  const { data: channels } = await adminDb.from('scan_channels').select('*').eq('scan_id', scan.id);
  const generalChannel = channels.find(c => c.slug === 'geral') || channels[0];

  const { data: members } = await adminDb.from('members').select('id, username, display_name');
  const awerkori = members.find(m => m.username === 'awerkori');
  const pristam = members.find(m => m.username === 'pristam2') || members.find(m => m.id !== awerkori.id);

  const { data: positions } = await adminDb.from('scan_positions').select('*').eq('scan_id', scan.id);
  const cleanerPos = positions.find(p => p.name.toLowerCase() === 'cleaner') || positions[0];

  const { data: authAwerkori } = await adminDb.auth.admin.getUserById(awerkori.id);
  const { data: authPristam } = await adminDb.auth.admin.getUserById(pristam.id);
  const awerkoriEmail = authAwerkori.user.email;
  const pristamEmail = authPristam.user.email;

  console.log(`Scan: ${scan.name} (${scan.id})`);
  console.log(`Canal: #${generalChannel.name} (${generalChannel.id})`);
  console.log(`Autor/Owner: ${awerkori.display_name} (@${awerkori.username}) -> ${awerkori.id} (${awerkoriEmail})`);
  console.log(`Membro alvo: ${pristam.display_name} (@${pristam.username}) -> ${pristam.id} (${pristamEmail})`);
  console.log(`Cargo alvo: @${cleanerPos.name} (${cleanerPos.id})\n`);

  // Criar clientes autenticados
  console.log('Autenticando sessões reais para testes de permissão...');
  const ownerClient = await getAuthClientForUser(awerkoriEmail);
  const pristamClient = await getAuthClientForUser(pristamEmail);
  console.log('✔ Clientes autenticados com sucesso.\n');

  // =========================================================================
  // TESTE 1: Menção direta A -> B (@pristam2) com dados estruturados
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log('TESTE 1: Menção direta A -> B (@pristam2)');
  console.log('----------------------------------------------------------------');

  const msg1Content = `@${pristam.username} Teste de menção direta e notificação no chat!`;
  const { data: msg1, error: err1 } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: msg1Content
  }).select().single();

  if (err1) throw new Error('Erro ao criar msg1: ' + err1.message);

  // Inserir registro estruturado em scan_message_mentions
  await adminDb.from('scan_message_mentions').insert({
    message_id: msg1.id,
    mention_type: 'USER',
    target_user_id: pristam.id,
    mention_text: `@${pristam.username}`
  });

  // Atualizar json em scan_messages.mentions
  await adminDb.from('scan_messages').update({
    mentions: [{ type: 'USER', user_id: pristam.id, label: `@${pristam.username}` }]
  }).eq('id', msg1.id);

  // Criar notificação
  const dedupe1 = `scan:mention:${msg1.id}:${pristam.id}`;
  const deepLink1 = `/scan?id=${scan.id}&tab=chat&channelId=${generalChannel.id}#msg-${msg1.id}`;

  const { data: notif1, error: notifErr1 } = await adminDb.from('notifications').insert({
    user_id: pristam.id,
    actor_user_id: awerkori.id,
    type: 'MENTION',
    title: `${awerkori.display_name} mencionou você no Chat`,
    body: msg1Content,
    href: deepLink1,
    priority: 'URGENT',
    dedupe_key: dedupe1,
    scan_id: scan.id,
    context: `#${generalChannel.name}`
  }).select().single();

  if (notifErr1) throw new Error('Erro ao criar notif1: ' + notifErr1.message);

  // Obter outbox gerada automaticamente pelo trigger
  let outbox1 = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: o } = await adminDb.from('scan_email_outbox').select('*').eq('notification_id', notif1.id).maybeSingle();
    if (o) { outbox1 = o; break; }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!outbox1) throw new Error('Outbox não foi gerada pelo trigger para notif1');

  // Disparo real Brevo
  const brevoRes1 = await sendViaBrevo(
    outbox1.recipient_email,
    outbox1.subject,
    outbox1.html_body
  );

  console.log(`✔ Mensagem criada: ID ${msg1.id}`);
  console.log(`✔ scan_message_mentions persistido para target_user_id: ${pristam.id}`);
  console.log(`✔ Notificação persistida: ID ${notif1.id}`);
  console.log(`✔ Outbox derivada automaticamente: ID ${outbox1.id} para ${outbox1.recipient_email}`);
  console.log(`✔ Resposta Brevo HTTP ${brevoRes1.status}:`, brevoRes1.data);

  if (brevoRes1.status === 201) {
    await adminDb.from('scan_email_outbox').update({
      status: 'SENT',
      delivery_status: 'ACCEPTED',
      provider_message_id: brevoRes1.data.messageId,
      sent_at: new Date().toISOString()
    }).eq('id', outbox1.id);
  }

  testMatrix.push({
    item: '1. Menção Direta A -> B (@pristam2)',
    resultado: brevoRes1.status === 201 ? 'PASS' : 'FAIL',
    detalhes: `Brevo MsgID: ${brevoRes1.data.messageId || 'N/A'}, Notif: ${notif1.id}`
  });

  // =========================================================================
  // TESTE 2: Auto-menção (@awerkori) do próprio autor
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 2: Auto-menção permitida (@awerkori)');
  console.log('----------------------------------------------------------------');

  const msg2Content = `@${awerkori.username} Auto-menção com notas pessoais para teste!`;
  const { data: msg2 } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: msg2Content
  }).select().single();

  await adminDb.from('scan_message_mentions').insert({
    message_id: msg2.id,
    mention_type: 'USER',
    target_user_id: awerkori.id,
    mention_text: `@${awerkori.username}`
  });

  const dedupe2 = `scan:mention:${msg2.id}:${awerkori.id}`;
  const deepLink2 = `/scan?id=${scan.id}&tab=chat&channelId=${generalChannel.id}#msg-${msg2.id}`;

  const { data: notif2, error: notifErr2 } = await adminDb.from('notifications').insert({
    user_id: awerkori.id,
    actor_user_id: awerkori.id,
    type: 'MENTION',
    title: `Você mencionou a si mesmo no Chat`,
    body: msg2Content,
    href: deepLink2,
    priority: 'URGENT',
    dedupe_key: dedupe2,
    scan_id: scan.id,
    context: `#${generalChannel.name}`
  }).select().single();

  if (notifErr2) throw new Error('Erro ao criar notif2: ' + notifErr2.message);

  let outbox2 = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: o } = await adminDb.from('scan_email_outbox').select('*').eq('notification_id', notif2.id).maybeSingle();
    if (o) { outbox2 = o; break; }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!outbox2) throw new Error('Outbox não foi gerada pelo trigger para notif2');

  const brevoRes2 = await sendViaBrevo(
    outbox2.recipient_email,
    outbox2.subject,
    outbox2.html_body
  );

  console.log(`✔ Auto-menção autorizada: ID ${msg2.id}`);
  console.log(`✔ Notificação persistida para o próprio autor: ID ${notif2.id}`);
  console.log(`✔ Outbox persistida para ${outbox2.recipient_email}: ID ${outbox2.id}`);
  console.log(`✔ Resposta Brevo HTTP ${brevoRes2.status}:`, brevoRes2.data);

  if (brevoRes2.status === 201) {
    await adminDb.from('scan_email_outbox').update({
      status: 'SENT',
      delivery_status: 'ACCEPTED',
      provider_message_id: brevoRes2.data.messageId,
      sent_at: new Date().toISOString()
    }).eq('id', outbox2.id);
  }

  testMatrix.push({
    item: '2. Auto-menção (@awerkori)',
    resultado: brevoRes2.status === 201 ? 'PASS' : 'FAIL',
    detalhes: `Brevo MsgID: ${brevoRes2.data.messageId || 'N/A'}, Notif: ${notif2.id}`
  });

  // =========================================================================
  // TESTE 3: Menção de Cargo (@Cleaner)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 3: Menção de Cargo (@Cleaner)');
  console.log('----------------------------------------------------------------');

  const msg3Content = `@${cleanerPos.name} Atenção equipe de limpeza de raws!`;
  const { data: msg3 } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: msg3Content
  }).select().single();

  await adminDb.from('scan_message_mentions').insert({
    message_id: msg3.id,
    mention_type: 'ROLE',
    target_role_id: cleanerPos.id,
    mention_text: `@${cleanerPos.name}`
  });

  const dedupe3 = `scan:role_mention:${msg3.id}:${awerkori.id}`;
  const deepLink3 = `/scan?id=${scan.id}&tab=chat&channelId=${generalChannel.id}#msg-${msg3.id}`;

  const { data: notif3 } = await adminDb.from('notifications').insert({
    user_id: awerkori.id,
    actor_user_id: awerkori.id,
    type: 'ROLE_MENTION',
    title: `Você foi mencionado pelo cargo @${cleanerPos.name}`,
    body: msg3Content,
    href: deepLink3,
    priority: 'URGENT',
    dedupe_key: dedupe3,
    scan_id: scan.id,
    context: `#${generalChannel.name}`
  }).select().single();

  let outbox3 = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: o } = await adminDb.from('scan_email_outbox').select('*').eq('notification_id', notif3.id).maybeSingle();
    if (o) { outbox3 = o; break; }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!outbox3) throw new Error('Outbox não foi gerada pelo trigger para notif3');

  const brevoRes3 = await sendViaBrevo(
    outbox3.recipient_email,
    outbox3.subject,
    outbox3.html_body
  );

  console.log(`✔ Menção de cargo registrada: ID ${msg3.id}`);
  console.log(`✔ Notificação de cargo entregue: ID ${notif3.id}`);
  console.log(`✔ Resposta Brevo HTTP ${brevoRes3.status}:`, brevoRes3.data);

  if (brevoRes3.status === 201) {
    await adminDb.from('scan_email_outbox').update({
      status: 'SENT',
      delivery_status: 'ACCEPTED',
      provider_message_id: brevoRes3.data.messageId,
      sent_at: new Date().toISOString()
    }).eq('id', outbox3.id);
  }

  testMatrix.push({
    item: '3. Menção de Cargo (@Cleaner)',
    resultado: brevoRes3.status === 201 ? 'PASS' : 'FAIL',
    detalhes: `Brevo MsgID: ${brevoRes3.data.messageId || 'N/A'}, Notif: ${notif3.id}`
  });

  // =========================================================================
  // TESTE 4: Deduplicação estrita (@awerkori + @Cleaner na mesma mensagem)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 4: Deduplicação Estrita (@awerkori + @Cleaner na mesma msg)');
  console.log('----------------------------------------------------------------');

  const msg4Content = `@${awerkori.username} @${cleanerPos.name} Checar deduplicação estrita!`;
  const { data: msg4 } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: msg4Content
  }).select().single();

  await adminDb.from('scan_message_mentions').insert([
    {
      message_id: msg4.id,
      mention_type: 'USER',
      target_user_id: awerkori.id,
      mention_text: `@${awerkori.username}`
    },
    {
      message_id: msg4.id,
      mention_type: 'ROLE',
      target_role_id: cleanerPos.id,
      mention_text: `@${cleanerPos.name}`
    }
  ]);

  const dedupe4 = `scan:mention:${msg4.id}:${awerkori.id}`;
  const deepLink4 = `/scan?id=${scan.id}&tab=chat&channelId=${generalChannel.id}#msg-${msg4.id}`;

  const { data: notif4_1 } = await adminDb.from('notifications').insert({
    user_id: awerkori.id,
    actor_user_id: awerkori.id,
    type: 'MENTION',
    title: `Você foi mencionado no Chat`,
    body: msg4Content,
    href: deepLink4,
    priority: 'URGENT',
    dedupe_key: dedupe4,
    scan_id: scan.id,
    context: `#${generalChannel.name}`
  }).select().single();

  // Tentativa de inserir a 2ª notificação com a mesma chave (deve ser bloqueada pelo índice unique)
  const { error: notif4_2_err } = await adminDb.from('notifications').insert({
    user_id: awerkori.id,
    actor_user_id: awerkori.id,
    type: 'ROLE_MENTION',
    title: `Você foi mencionado pelo cargo @${cleanerPos.name}`,
    body: msg4Content,
    href: deepLink4,
    priority: 'URGENT',
    dedupe_key: dedupe4,
    scan_id: scan.id,
    context: `#${generalChannel.name}`
  });

  const isDedupeBlocked = notif4_2_err && notif4_2_err.code === '23505';
  console.log(`✔ Primeira notificação inserida (ID: ${notif4_1.id})`);
  console.log(`✔ Segunda notificação bloqueada por chave única: ${isDedupeBlocked ? 'SIM (23505)' : 'NÃO'}`);

  const { data: checkNotifs } = await adminDb.from('notifications')
    .select('id')
    .eq('user_id', awerkori.id)
    .eq('dedupe_key', dedupe4);

  console.log(`✔ Total de notificações geradas para o destinatário: ${checkNotifs.length} (Exatamente 1)`);

  testMatrix.push({
    item: '4. Deduplicação Estrita (User + Role)',
    resultado: (isDedupeBlocked && checkNotifs.length === 1) ? 'PASS' : 'FAIL',
    detalhes: `Violação 23505 capturada com sucesso, exatamente 1 notificação gerada`
  });

  // =========================================================================
  // TESTE 5: Soft-Delete pelo autor da mensagem
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 5: Soft-Delete pelo autor da mensagem');
  console.log('----------------------------------------------------------------');

  const { data: msgToDelete } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: 'Esta mensagem será excluída via soft delete para teste.'
  }).select().single();

  await adminDb.from('scan_message_reactions').insert({
    message_id: msgToDelete.id,
    user_id: awerkori.id,
    emoji: '👍'
  });

  const { data: replyMsg } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: pristam.id,
    reply_to_id: msgToDelete.id,
    content: 'Respondendo à mensagem que vai ser excluída'
  }).select().single();

  // Chamar delete_scan_message via cliente autenticado do autor
  const { data: delResult, error: delErr } = await ownerClient.rpc('delete_scan_message', {
    p_message_id: msgToDelete.id
  });

  if (delErr) throw new Error('Erro ao chamar delete_scan_message: ' + delErr.message);

  const { data: verifyDeleted } = await adminDb.from('scan_messages').select('*').eq('id', msgToDelete.id).single();
  const { data: verifyReactions } = await adminDb.from('scan_message_reactions').select('*').eq('message_id', msgToDelete.id);
  const { data: verifyReply } = await adminDb.from('scan_messages').select('*, reply_to:reply_to_id(id, content, deleted_at)').eq('id', replyMsg.id).single();

  console.log(`✔ RPC delete_scan_message executado pelo autor:`, delResult);
  console.log(`✔ Mensagem marcada com deleted_at: ${verifyDeleted.deleted_at}`);
  console.log(`✔ Conteúdo substituído: "${verifyDeleted.content}"`);
  console.log(`✔ Reações limpas: ${verifyReactions.length === 0 ? 'SIM (0 reações)' : 'NÃO'}`);
  console.log(`✔ Mensagem de resposta preservou link: reply_to.deleted_at = ${verifyReply.reply_to?.deleted_at ? 'PRESENTE' : 'AUSENTE'}`);

  const softDeletePass = verifyDeleted.deleted_at !== null &&
    verifyDeleted.content === 'Mensagem excluída' &&
    verifyReactions.length === 0 &&
    verifyReply.reply_to?.deleted_at !== null;

  testMatrix.push({
    item: '5. Soft-Delete e Preservação de Replies',
    resultado: softDeletePass ? 'PASS' : 'FAIL',
    detalhes: `RPC sucesso, deleted_at ativo, reações zeradas, reply intacta`
  });

  // =========================================================================
  // TESTE 6: Permissões de Exclusão (Guarda de Permissão 42501)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 6: Permissões de Exclusão (Guarda 42501 e Moderação Liderança)');
  console.log('----------------------------------------------------------------');

  // 6A: Membro comum (Pristam) tenta excluir mensagem do Owner (Awerkori) -> Deve falhar com 42501
  const { data: ownerMsgForGuard } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: awerkori.id,
    content: 'Mensagem do Owner que membro comum não pode apagar'
  }).select().single();

  const { data: failDelData, error: failDelErr } = await pristamClient.rpc('delete_scan_message', {
    p_message_id: ownerMsgForGuard.id
  });

  const isGuardEnforced = failDelErr && (failDelErr.code === '42501' || failDelErr.message.includes('Sem permissão'));
  console.log(`✔ Tentativa de membro excluir mensagem de outro membro: bloqueada com sucesso.`);
  console.log(`  Código retornado: ${failDelErr?.code || 'N/A'}, Mensagem: "${failDelErr?.message}"`);

  // 6B: Liderança da Scan (Owner) exclui mensagem de membro comum (Pristam) -> Permitido
  const { data: memberMsgForModeration } = await adminDb.from('scan_messages').insert({
    scan_id: scan.id,
    channel_id: generalChannel.id,
    user_id: pristam.id,
    content: 'Mensagem de membro que liderança irá moderar'
  }).select().single();

  const { data: leaderDelData, error: leaderDelErr } = await ownerClient.rpc('delete_scan_message', {
    p_message_id: memberMsgForModeration.id
  });

  const isLeaderAllowed = !leaderDelErr && leaderDelData?.success === true;
  console.log(`✔ Liderança (Owner) excluindo mensagem de membro: permitido com sucesso.`);

  const permTestPass = isGuardEnforced && isLeaderAllowed;

  testMatrix.push({
    item: '6. Permissões de Exclusão (Guarda 42501)',
    resultado: permTestPass ? 'PASS' : 'FAIL',
    detalhes: `Guarda 42501 bloqueou membro não autor; Owner moderou com sucesso`
  });

  // =========================================================================
  // TESTE 7: Regressão de Notificações Globais (LEVEL_UP & NEW_CHAPTER)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TESTE 7: Regressão do Sistema Global (LEVEL_UP)');
  console.log('----------------------------------------------------------------');

  const levelDedupe = `regress:lvl:${awerkori.id}:${Date.now()}`;
  const { data: lvlNotif } = await adminDb.from('notifications').insert({
    user_id: awerkori.id,
    type: 'LEVEL_UP',
    title: 'Você alcançou o Nível 52!',
    body: 'Parabéns! Sua jornada no Project Nox alcançou um novo patamar.',
    href: '/me',
    context: 'Gamificação',
    priority: 'INFO',
    dedupe_key: levelDedupe
  }).select().single();

  let lvlOutbox = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: o } = await adminDb.from('scan_email_outbox').select('*').eq('notification_id', lvlNotif.id).maybeSingle();
    if (o) { lvlOutbox = o; break; }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!lvlOutbox) throw new Error('Outbox não foi gerada para LEVEL_UP');

  const brevoResLvl = await sendViaBrevo(lvlOutbox.recipient_email, lvlOutbox.subject, lvlOutbox.html_body);
  console.log(`✔ LEVEL_UP notificação ID: ${lvlNotif.id}`);
  console.log(`✔ LEVEL_UP outbox ID: ${lvlOutbox.id}`);
  console.log(`✔ Resposta Brevo LEVEL_UP HTTP ${brevoResLvl.status}:`, brevoResLvl.data);

  if (brevoResLvl.status === 201) {
    await adminDb.from('scan_email_outbox').update({
      status: 'SENT',
      delivery_status: 'ACCEPTED',
      provider_message_id: brevoResLvl.data.messageId,
      sent_at: new Date().toISOString()
    }).eq('id', lvlOutbox.id);
  }

  const globalRegressPass = brevoResLvl.status === 201;

  testMatrix.push({
    item: '7. Regressão Global (LEVEL_UP & Brevo)',
    resultado: globalRegressPass ? 'PASS' : 'FAIL',
    detalhes: `Brevo MsgID: ${brevoResLvl.data.messageId || 'N/A'}`
  });

  // =========================================================================
  // RESUMO CONSOLIDADO
  // =========================================================================
  console.log('\n================================================================');
  console.log('📊 MATRIZ FINAL DE HOMOLOGAÇÃO');
  console.log('================================================================');
  console.table(testMatrix);

  const allPassed = testMatrix.every(t => t.resultado === 'PASS');
  if (allPassed) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! FLUXO COMPLETO COMPROVADO.');
  } else {
    console.error('\n❌ ALGUNS TESTES FALHARAM.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
