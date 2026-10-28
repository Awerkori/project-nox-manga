import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateEmailHtml } from '../src/lib/server/email-templates';

describe('authentication email templates', () => {
  for (const [name, type] of [
    ['confirmation', 'signup'],
    ['recovery', 'recovery'],
    ['email_change', 'email_change'],
    ['invite', 'invite']
  ]) {
    it(`${name} uses the site's token-hash callback without scripts or third-party links`, () => {
      const html = readFileSync(`supabase/templates/${name}.html`, 'utf8');
      expect(html).toContain('lang="pt-BR"');
      expect(html).toContain('PROJECT NOX');
      expect(html).toContain('PROJECT');
      expect(html).toContain('NOX');
      expect(html).toContain('#dfc28d'); // Gold
      expect(html).toContain('#b59af5'); // Purple
      expect(html).toContain(
        `href="https://manga.project-nox-awerkori.workers.dev/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}"`
      );
      expect(html).not.toContain('projectnox.com');
      expect(html).not.toMatch(/<script\b|\son\w+\s*=|javascript:/i);
      expect(html).not.toContain('{{ .ConfirmationURL }}');
      expect(html.match(/href=/g)).toHaveLength(1);
    });
  }
});

describe('transactional email generator (generateEmailHtml)', () => {
  const allTypes = [
    'TICKET_REPORT',
    'TICKET_SCAN_APPLICATION',
    'TICKET_MODERATION',
    'TASK_ASSIGNED',
    'STAGE_READY',
    'QC_ISSUE',
    'REWORK',
    'APPLICATION',
    'APPLICATION_UPDATE',
    'MURAL_POST',
    'MENTION',
    'ROLE_MENTION',
    'REPLY_CHAT',
    'REPLY_COMMENT',
    'NEW_CHAPTER',
    'LEVEL_UP',
    'ACHIEVEMENT',
    'SYSTEM',
    'TASK_REMINDER_STALE',
    'STAGE_UNCLAIMED_REMINDER',
    'SCAN_INVITE',
    'SCAN_ROLE_UPDATED',
    'SECURITY_PASSWORD_CHANGED',
    'SECURITY_EMAIL_CHANGED'
  ];

  for (const type of allTypes) {
    it(`renders valid email for type ${type}`, () => {
      const res = generateEmailHtml({
        type,
        title: `Teste de Notificação para ${type}`,
        body: `Corpo detalhado da mensagem de teste para ${type}.`,
        deepLink: '/admin/tickets',
        context: 'Distant Sky — Cap. #12',
        recipientName: 'Awerkori',
        actorName: 'Moderador Nox',
        meta: {
          'Obra': 'Distant Sky',
          'Capítulo': '12',
          'Status': 'Pendente'
        }
      });

      expect(res.subject).toBeTruthy();
      expect(res.html).toContain('<!DOCTYPE html>');
      expect(res.html).toContain('lang="pt-BR"');
      // Logo lockup colors and centered alignment
      expect(res.html).toContain('#dfc28d'); // Gold PROJECT
      expect(res.html).toContain('#b59af5'); // Purple NOX
      expect(res.html).toContain('PROJECT');
      expect(res.html).toContain('NOX');
      // Recipient name
      expect(res.html).toContain('Awerkori');
      // Metadata table
      expect(res.html).toContain('Distant Sky');
      // Fallback link
      expect(res.html).toContain('https://manga.project-nox-awerkori.workers.dev/admin/tickets');
      // Button arrow rendering: clean single Unicode arrow, no double escaping or entity leakage
      expect(res.html).toContain(' →');
      expect(res.html).not.toContain('&amp;rarr;');
      expect(res.html).not.toContain('&rarr; →');
      expect(res.html).not.toContain('→ →');
      expect(res.html).not.toContain('&amp;amp;');
      // Plain text version
      expect(res.text).toContain('Awerkori');
      expect(res.text).toContain('https://manga.project-nox-awerkori.workers.dev/admin/tickets');
    });
  }
});
