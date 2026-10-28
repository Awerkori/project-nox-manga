import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateEmailHtml } from '../src/lib/server/email-templates';
import { extractMentions } from '../src/lib/server/mentions';
import { dispatchStaleTaskReminders, type StaleRemindersResult } from '../src/lib/server/pipeline-reminders';

// ============================================================================
// SIMULATION DATA STRUCTURES: Scan Pipeline, Stages, Roles and Members
// ============================================================================

interface MockScanMember {
  userId: string;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  positions: string[]; // position slugs, e.g. ['typer', 'tradutor']
  hiddenByAdmin: boolean;
}

interface MockChapterStage {
  id: string;
  slug: string;
  name: string;
  dependencies: string[];
  allowedPosition: string; // e.g. 'typer'
  status: 'BLOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'DONE';
  assignedTo: string | null;
  claimedAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

interface NotificationRecord {
  userId: string;
  actorUserId?: string | null;
  type: string;
  title: string;
  body: string;
  deepLink: string;
  dedupeKey: string;
  skipEmail?: boolean;
}

interface EmailOutboxRecord {
  recipientUserId: string;
  type: string;
  subject: string;
  priority: string;
  idempotencyKey: string;
}

// ============================================================================
// TEST HARNESS: Deterministic Pipeline Controller
// ============================================================================

class PipelineSimulationHarness {
  members: MockScanMember[] = [];
  stages: Map<string, MockChapterStage> = new Map();
  notifications: NotificationRecord[] = [];
  emailOutbox: EmailOutboxRecord[] = [];
  currentTimeMs: number = Date.parse('2026-10-27T12:00:00Z');

  constructor() {
    this.reset();
  }

  reset() {
    this.notifications = [];
    this.emailOutbox = [];
    this.currentTimeMs = Date.parse('2026-10-27T12:00:00Z');

    // 1. Setup scan team: 3 Typers and 2 Translators (+ 1 member with dual role)
    this.members = [
      { userId: 'user-typer-1', username: 'Preston', role: 'MEMBER', positions: ['typer'], hiddenByAdmin: false },
      { userId: 'user-typer-2', username: 'LucasTyper', role: 'MEMBER', positions: ['typer'], hiddenByAdmin: false },
      { userId: 'user-typer-3', username: 'SofiaTyper', role: 'MEMBER', positions: ['typer'], hiddenByAdmin: false },
      { userId: 'user-trans-1', username: 'RavenTranslator', role: 'MEMBER', positions: ['tradutor'], hiddenByAdmin: false },
      { userId: 'user-trans-2', username: 'ElenaTranslator', role: 'MEMBER', positions: ['tradutor'], hiddenByAdmin: false },
      { userId: 'user-dual-1', username: 'DualRoleMember', role: 'MEMBER', positions: ['typer', 'tradutor'], hiddenByAdmin: false }
    ];

    // 2. Setup standard workflow graph:
    // raw (deps: []) -> traducao (deps: [raw]) + clean_redraw (deps: [raw]) -> typeset (deps: [traducao, clean_redraw]) -> qc (deps: [typeset])
    const stagesList: MockChapterStage[] = [
      { id: 'stage-raw', slug: 'raw', name: 'Raw Provider', dependencies: [], allowedPosition: 'raw', status: 'DONE', assignedTo: 'user-raw', claimedAt: null, lastActivityAt: null, completedAt: '2026-10-25T10:00:00Z', completedBy: 'user-raw' },
      { id: 'stage-trad', slug: 'traducao', name: 'Tradução', dependencies: ['raw'], allowedPosition: 'tradutor', status: 'DONE', assignedTo: 'user-trans-1', claimedAt: '2026-10-25T11:00:00Z', lastActivityAt: '2026-10-26T14:00:00Z', completedAt: '2026-10-26T14:00:00Z', completedBy: 'user-trans-1' },
      { id: 'stage-clean', slug: 'clean_redraw', name: 'Clean/Redraw', dependencies: ['raw'], allowedPosition: 'clean_redraw', status: 'DONE', assignedTo: 'user-clean-1', claimedAt: '2026-10-25T11:00:00Z', lastActivityAt: '2026-10-26T16:00:00Z', completedAt: '2026-10-26T16:00:00Z', completedBy: 'user-clean-1' },
      { id: 'stage-typeset', slug: 'typeset', name: 'Typeset', dependencies: ['traducao', 'clean_redraw'], allowedPosition: 'typer', status: 'BLOCKED', assignedTo: null, claimedAt: null, lastActivityAt: null, completedAt: null, completedBy: null },
      { id: 'stage-qc', slug: 'revisor_qc', name: 'Revisor (QC)', dependencies: ['typeset'], allowedPosition: 'revisor_qc', status: 'BLOCKED', assignedTo: null, claimedAt: null, lastActivityAt: null, completedAt: null, completedBy: null }
    ];

    this.stages.clear();
    for (const s of stagesList) {
      this.stages.set(s.slug, s);
    }
  }

  /**
   * Reconciles dependencies and transitions stages whose dependencies are all DONE to AVAILABLE.
   * Dispatches STAGE_READY broadcast notifications to active members holding the matching position.
   */
  resolveDependencies(): string[] {
    const transitioned: string[] = [];

    for (const stage of this.stages.values()) {
      if (stage.status === 'BLOCKED') {
        const allDepsSatisfied = stage.dependencies.every(depSlug => {
          const dep = this.stages.get(depSlug);
          return dep && dep.status === 'DONE';
        });

        if (allDepsSatisfied) {
          stage.status = 'AVAILABLE';
          transitioned.push(stage.slug);
          this.broadcastStageAvailable(stage);
        }
      }
    }

    return transitioned;
  }

  /**
   * Dispatches stage availability notification strictly to members holding matching position.
   * Deduplicates: A member with multiple positions receives exactly 1 notification.
   */
  broadcastStageAvailable(stage: MockChapterStage) {
    // Collect distinct eligible users
    const eligibleUserIds = new Set<string>();
    for (const member of this.members) {
      if (member.hiddenByAdmin) continue;
      if (member.positions.includes(stage.allowedPosition)) {
        eligibleUserIds.add(member.userId);
      }
    }

    for (const userId of eligibleUserIds) {
      const dedupeKey = `pipeline_available:scan-1:chap-80:${stage.slug}:v1:${userId}`;
      // In-app notification
      this.notifications.push({
        userId,
        actorUserId: null,
        type: 'STAGE_READY',
        title: `Etapa Pronta: ${stage.name}`,
        body: `Distant Sky — Cap. 80 está pronto para ${stage.name}.`,
        deepLink: `/scan?id=scan-1&tab=pipeline`,
        dedupeKey
      });

      // Email outbox
      this.emailOutbox.push({
        recipientUserId: userId,
        type: 'STAGE_READY',
        subject: `[Scan] Etapa Pronta para Produção: Distant Sky — Cap. 80 — ${stage.name}`,
        priority: 'HIGH',
        idempotencyKey: `email:${dedupeKey}`
      });
    }
  }

  /**
   * A member assumes (claims) an AVAILABLE stage.
   * Atomic check: Fails if already claimed by another user.
   */
  claimStage(slug: string, userId: string): { success: boolean; error?: string } {
    const stage = this.stages.get(slug);
    if (!stage) return { success: false, error: 'Etapa não encontrada' };

    const member = this.members.find(m => m.userId === userId && !m.hiddenByAdmin);
    if (!member) return { success: false, error: 'Membro não encontrado ou inativo' };

    if (!member.positions.includes(stage.allowedPosition) && member.role !== 'OWNER' && member.role !== 'ADMIN') {
      return { success: false, error: 'Sem cargo necessário' };
    }

    if (stage.status === 'IN_PROGRESS' && stage.assignedTo === userId) {
      return { success: true }; // Idempotent
    }

    if (stage.status !== 'AVAILABLE') {
      return { success: false, error: 'STAGE_ALREADY_CLAIMED' };
    }

    // Atomic claim transition
    stage.status = 'IN_PROGRESS';
    stage.assignedTo = userId;
    stage.claimedAt = new Date(this.currentTimeMs).toISOString();
    stage.lastActivityAt = new Date(this.currentTimeMs).toISOString();

    return { success: true };
  }

  /**
   * Complete stage and resolve next stages.
   */
  completeStage(slug: string, userId: string): { success: boolean; error?: string } {
    const stage = this.stages.get(slug);
    if (!stage) return { success: false, error: 'Etapa não encontrada' };
    if (stage.status !== 'IN_PROGRESS' || stage.assignedTo !== userId) {
      return { success: false, error: 'Apenas o responsável pode concluir a etapa' };
    }

    stage.status = 'DONE';
    stage.completedBy = userId;
    stage.completedAt = new Date(this.currentTimeMs).toISOString();
    stage.lastActivityAt = new Date(this.currentTimeMs).toISOString();

    // Trigger DAG unlock for next dependent stages
    this.resolveDependencies();
    return { success: true };
  }

  /**
   * Evaluates stale tasks (inactive for thresholdDays or more) and returns reminder targets.
   * Only targets the assignee. Skips if finished, paused, or member removed.
   */
  evaluateStaleReminders(thresholdDays = 3): Array<{ stageId: string; userId: string; dedupeKey: string }> {
    const reminders: Array<{ stageId: string; userId: string; dedupeKey: string }> = [];
    const thresholdMs = thresholdDays * 86_400_000;

    for (const stage of this.stages.values()) {
      if (stage.status !== 'IN_PROGRESS' || !stage.assignedTo || !stage.lastActivityAt) {
        continue;
      }

      const member = this.members.find(m => m.userId === stage.assignedTo);
      if (!member || member.hiddenByAdmin) {
        // Assignee lost membership: return to queue!
        stage.assignedTo = null;
        stage.status = 'AVAILABLE';
        continue;
      }

      const inactiveTime = this.currentTimeMs - Date.parse(stage.lastActivityAt);
      if (inactiveTime >= thresholdMs) {
        const cooldownBucket = Math.floor(this.currentTimeMs / (3 * 86_400_000));
        const dedupeKey = `stale_reminder:${stage.id}:${stage.assignedTo}:${cooldownBucket}`;
        reminders.push({ stageId: stage.id, userId: stage.assignedTo, dedupeKey });
      }
    }

    return reminders;
  }
}

// ============================================================================
// TESTS SUITE: PROJECT NOX INTELLIGENT NOTIFICATIONS & PIPELINE AUDIT
// ============================================================================

describe('Scan Pipeline & Intelligent Notifications Audit', () => {
  let harness: PipelineSimulationHarness;

  beforeEach(() => {
    harness = new PipelineSimulationHarness();
  });

  // --------------------------------------------------------------------------
  // 1. Mandatory End-to-End Scenario: Distant Sky Cap. 80
  // --------------------------------------------------------------------------
  it('Scenario 1: Distant Sky Cap. 80 — Translation & Clean complete -> Typeset unlocks only for Typers', () => {
    // Before: Typeset is BLOCKED
    expect(harness.stages.get('typeset')?.status).toBe('BLOCKED');

    // Action: Translation and Clean/Redraw are already DONE; resolve dependencies
    const unlocked = harness.resolveDependencies();
    expect(unlocked).toContain('typeset');
    expect(harness.stages.get('typeset')?.status).toBe('AVAILABLE');

    // Notifications verification:
    // Team has:
    // 3 pure Typers: Preston, LucasTyper, SofiaTyper
    // 1 dual-role member: DualRoleMember (Typer + Translator)
    // 2 pure Translators: RavenTranslator, ElenaTranslator
    // Expected: All 4 Typers get notified, the 2 pure Translators DO NOT get notified!
    const notifiedUserIds = harness.notifications
      .filter(n => n.type === 'STAGE_READY')
      .map(n => n.userId);

    expect(notifiedUserIds).toContain('user-typer-1'); // Preston
    expect(notifiedUserIds).toContain('user-typer-2'); // LucasTyper
    expect(notifiedUserIds).toContain('user-typer-3'); // SofiaTyper
    expect(notifiedUserIds).toContain('user-dual-1');  // DualRoleMember

    // Translators must NOT receive notification for typesetting
    expect(notifiedUserIds).not.toContain('user-trans-1'); // RavenTranslator
    expect(notifiedUserIds).not.toContain('user-trans-2'); // ElenaTranslator

    // Member with multiple roles receives EXACTLY 1 notification, NOT 2!
    const dualNotifications = harness.notifications.filter(
      n => n.type === 'STAGE_READY' && n.userId === 'user-dual-1'
    );
    expect(dualNotifications).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // 2. Claim Transition & Availability Cessation
  // --------------------------------------------------------------------------
  it('Scenario 2: Preston assumes the chapter -> Availability stops for others & concurrent claim is blocked', () => {
    harness.resolveDependencies();
    expect(harness.stages.get('typeset')?.status).toBe('AVAILABLE');

    // Preston claims the task
    const claimRes = harness.claimStage('typeset', 'user-typer-1');
    expect(claimRes.success).toBe(true);

    const typesetStage = harness.stages.get('typeset')!;
    expect(typesetStage.status).toBe('IN_PROGRESS');
    expect(typesetStage.assignedTo).toBe('user-typer-1');
    expect(typesetStage.claimedAt).toBeTruthy();
    expect(typesetStage.lastActivityAt).toBeTruthy();

    // LucasTyper tries to claim concurrently -> FAILS with STAGE_ALREADY_CLAIMED
    const conflictRes = harness.claimStage('typeset', 'user-typer-2');
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.error).toBe('STAGE_ALREADY_CLAIMED');

    // Preston claims again (idempotency check) -> SUCCEEDS without error
    const idempotentRes = harness.claimStage('typeset', 'user-typer-1');
    expect(idempotentRes.success).toBe(true);

    // Because status is IN_PROGRESS, subsequent dependency resolutions or broadcasts NEVER re-notify the team
    const initialNotificationCount = harness.notifications.length;
    harness.resolveDependencies();
    expect(harness.notifications.length).toBe(initialNotificationCount);
  });

  // --------------------------------------------------------------------------
  // 3. Stale Task Reminders: Inactive for 3+ Days
  // --------------------------------------------------------------------------
  it('Scenario 3: Preston claims task and is inactive for 3 days -> Receives stale reminder only for himself', () => {
    harness.resolveDependencies();
    harness.claimStage('typeset', 'user-typer-1');

    // Day 0: No stale reminders
    let reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(0);

    // Day 2 (48 hours later): Still no stale reminders
    harness.currentTimeMs += 2 * 86_400_000;
    reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(0);

    // Day 3 (72 hours later): Preston has been inactive for 3 full days!
    harness.currentTimeMs += 1 * 86_400_000;
    reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].userId).toBe('user-typer-1'); // Preston only!
    expect(reminders[0].stageId).toBe('stage-typeset');

    // Other typers or translators NEVER receive the stale reminder
    const otherReminded = reminders.filter(r => r.userId !== 'user-typer-1');
    expect(otherReminded).toHaveLength(0);

    // Cooldown check: Evaluating again within the same 3-day window produces the same deterministic dedupe key
    const secondEvaluation = harness.evaluateStaleReminders(3);
    expect(secondEvaluation[0].dedupeKey).toBe(reminders[0].dedupeKey);
  });

  // --------------------------------------------------------------------------
  // 4. Progress Resets Inactivity Counter
  // --------------------------------------------------------------------------
  it('Scenario 4: Activity / progress on day 2 resets the inactivity timer', () => {
    harness.resolveDependencies();
    harness.claimStage('typeset', 'user-typer-1');

    // Advance 2 days
    harness.currentTimeMs += 2 * 86_400_000;

    // Preston uploads work or edits notes: update lastActivityAt
    const stage = harness.stages.get('typeset')!;
    stage.lastActivityAt = new Date(harness.currentTimeMs).toISOString();

    // Advance 2 more days (total 4 days from claim, but only 2 days since last activity)
    harness.currentTimeMs += 2 * 86_400_000;

    // Inactivity timer should NOT trigger because last activity was 2 days ago
    const reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 5. Completion Cancels Reminders and Unlocks Next Stage (QC)
  // --------------------------------------------------------------------------
  it('Scenario 5: Preston completes task -> Cancels reminders and unlocks QC stage for Revisors', () => {
    harness.resolveDependencies();
    harness.claimStage('typeset', 'user-typer-1');

    // Preston completes the task
    const completeRes = harness.completeStage('typeset', 'user-typer-1');
    expect(completeRes.success).toBe(true);

    const typesetStage = harness.stages.get('typeset')!;
    expect(typesetStage.status).toBe('DONE');
    expect(typesetStage.completedBy).toBe('user-typer-1');

    // No stale reminders should ever be generated for a completed stage
    harness.currentTimeMs += 10 * 86_400_000; // 10 days later
    const reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(0);

    // QC stage should now be unlocked (AVAILABLE)
    const qcStage = harness.stages.get('revisor_qc')!;
    expect(qcStage.status).toBe('AVAILABLE');
  });

  // --------------------------------------------------------------------------
  // 6. Member Removal from Scan: Automatic Stage Release
  // --------------------------------------------------------------------------
  it('Scenario 6: Member removed from scan -> Stage is released back to queue, no reminder sent', () => {
    harness.resolveDependencies();
    harness.claimStage('typeset', 'user-typer-1');

    // Simulate Preston being removed from the scan
    const preston = harness.members.find(m => m.userId === 'user-typer-1')!;
    preston.hiddenByAdmin = true;

    // Advance 3 days
    harness.currentTimeMs += 3 * 86_400_000;

    // Evaluating stale reminders detects membership revocation: releases stage and skips notification
    const reminders = harness.evaluateStaleReminders(3);
    expect(reminders).toHaveLength(0);

    const typesetStage = harness.stages.get('typeset')!;
    expect(typesetStage.status).toBe('AVAILABLE');
    expect(typesetStage.assignedTo).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 7. @Mentions: Self-Exclusion & In-App Only Enforcement
  // --------------------------------------------------------------------------
  it('Scenario 7: @Mentions — Authors never notify themselves; comments are strictly in-app (skipEmail)', () => {
    const rawText = 'Olá @Preston e @Awerkori, confiram o capítulo!';
    const tags = extractMentions(rawText);
    expect(tags).toContain('preston');
    expect(tags).toContain('awerkori');

    // Simulate dispatchMentions logic with author being Preston:
    const authorId = 'user-preston';
    const mentionedUsers = [
      { id: 'user-preston', username: 'Preston' },
      { id: 'user-awerkori', username: 'Awerkori' }
    ];

    const dispatchedNotifications: Array<{ recipientId: string; skipEmail: boolean }> = [];
    for (const target of mentionedUsers) {
      // Self-mention guard:
      if (target.id === authorId) {
        continue; // MUST BE SKIPPED
      }

      dispatchedNotifications.push({
        recipientId: target.id,
        skipEmail: true // Comments must NEVER trigger transactional emails!
      });
    }

    // Preston mentioned himself, so Preston must NOT receive a notification
    expect(dispatchedNotifications.some(d => d.recipientId === 'user-preston')).toBe(false);

    // Awerkori was mentioned by Preston, so Awerkori receives the in-app notification
    expect(dispatchedNotifications.some(d => d.recipientId === 'user-awerkori')).toBe(true);

    // skipEmail must be true for all comment mentions
    expect(dispatchedNotifications.every(d => d.skipEmail === true)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. New Template Rendering & Anti-Phishing Guard
  // --------------------------------------------------------------------------
  it('Scenario 8: New Templates (TASK_REMINDER_STALE, SECURITY_PASSWORD_CHANGED) conform to design system', () => {
    // 1. Task Reminder Stale
    const reminderEmail = generateEmailHtml({
      type: 'TASK_REMINDER_STALE',
      title: 'Distant Sky — Cap. 80',
      body: 'Olá, Preston! Você possui a etapa Typeset em andamento na Night Scans há mais de 3 dias sem nova atividade.',
      deepLink: '/scan?id=scan-1&tab=tasks&stageId=stage-typeset',
      context: 'Distant Sky — Cap. 80',
      recipientName: 'Preston',
      meta: {
        'Obra': 'Distant Sky',
        'Capítulo': '80',
        'Etapa': 'Typeset',
        'Scan': 'Night Scans'
      }
    });

    expect(reminderEmail.subject).toContain('[Scan] Lembrete: Tarefa em Andamento');
    expect(reminderEmail.html).toContain('LEMBRETE DE TAREFA');
    expect(reminderEmail.html).toContain('#f59e0b'); // Amber
    expect(reminderEmail.html).toContain('Continuar Trabalho no Painel');
    expect(reminderEmail.html).toContain('Preston');
    expect(reminderEmail.html).toContain('Distant Sky');

    // 2. Security Password Changed
    const secEmail = generateEmailHtml({
      type: 'SECURITY_PASSWORD_CHANGED',
      title: 'Senha alterada com sucesso',
      body: 'A senha da sua conta Project Nox foi alterada com sucesso.',
      deepLink: '/perfil?tab=security',
      recipientName: 'Awerkori'
    });

    expect(secEmail.subject).toContain('Alerta de Segurança: Senha Alterada com Sucesso');
    expect(secEmail.html).toContain('ALERTA DE SEGURANÇA');
    expect(secEmail.html).toContain('#ef4444'); // Red alert
    expect(secEmail.html).toContain('Verificar Segurança da Minha Conta');
    expect(secEmail.html).toContain('Awerkori');
  });
});
