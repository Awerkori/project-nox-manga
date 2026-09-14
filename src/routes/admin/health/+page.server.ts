import { error } from '@sveltejs/kit';
import { withTimeout } from '$lib/server/resilience';

export type HealthSeverity = 'OTIMO' | 'BOM' | 'ATENCAO' | 'RUIM' | 'CRITICO' | 'SEM_DADOS';
let cached: { at: number; payload: any } | null = null;
let flight: Promise<any> | null = null;
const missing = 'Não medido';
const component = (id: string, title: string, icon: string, details: Record<string, any> = {}) => ({
  id, title, icon, status: 'SEM_DADOS' as HealthSeverity, statusLabel: 'Sem dados',
  summary: 'Sem medição recente suficiente para afirmar saúde.',
  trend24h: 'Sem série histórica', trend7d: 'Sem série histórica',
  derivation: 'Somente medições disponíveis; ausência de dados não significa zero erros.', details
});

export const load = async ({ locals }) => {
  if (!locals.user || locals.role !== 'ADMIN') error(403, 'Acesso exclusivo para administradores globais.');
  if (cached && Date.now() - cached.at < 15000) return cached.payload;
  if (flight) return flight;
  flight = (async () => {
    const [health, telemetry] = await Promise.all([
      withTimeout((locals.db as any).rpc('admin_get_system_health'), 2500, null, 'admin_get_system_health'),
      withTimeout(locals.db.from('importer_telemetry').select('rss_mb,concurrency,active_jobs,created_at,cycle_reason').order('created_at', { ascending: false }).limit(1).maybeSingle(), 2000, null, 'admin_importer_heartbeat')
    ]);
    const raw = (health as any)?.data;
    const db = raw?.database;
    const t = (telemetry as any)?.data;
    const fresh = t && Date.now() - Date.parse(t.created_at) < 180000;
    const database = component('database', 'PostgreSQL & Pool', 'Database', {
      'Conexões': db ? `${db.current_connections} / ${db.max_connections}` : missing,
      'Conexões ativas': db?.active_connections ?? missing,
      'Locks pendentes': db?.waiting_locks ?? missing,
      'Deadlocks acumulados': db?.deadlocks ?? missing,
      'idx_media_sha256': db ? (db.sha256_index_active ? 'Presente' : 'Ausente') : missing
    });
    if (db) {
      database.status = db.current_connections / db.max_connections >= .85 || !db.sha256_index_active ? 'CRITICO' : db.waiting_locks > 0 ? 'ATENCAO' : 'BOM';
      database.statusLabel = database.status;
      database.summary = 'Snapshot do banco disponível. Latência sob carga exige série de medições.';
    }
    const importer = component('importer', 'Importer Engine', 'Cpu', {
      'Última telemetria': t?.created_at ?? missing,
      'RSS na última amostra': t ? `${t.rss_mb} MB` : missing,
      'Concorrência na última amostra': t?.concurrency ?? missing,
      'Jobs na última amostra': t?.active_jobs ?? missing,
      'Motivo do autotuner': t?.cycle_reason ?? missing
    });
    if (t) {
      importer.status = fresh ? 'ATENCAO' : 'CRITICO';
      importer.statusLabel = fresh ? 'Heartbeat recente' : 'Telemetria vencida';
      importer.summary = fresh ? 'Processo reportando; publicação e legibilidade precisam ser verificadas.' : 'Sem heartbeat há mais de 3 minutos. Não considerar o Importer saudável.';
    }
    const criticalIssues = [database, importer].filter(c => c.status === 'CRITICO').map(c => c.title + ': ' + c.summary);
    const payload = {
      overall: { status: criticalIssues.length ? 'CRITICO' : 'ATENCAO', statusLabel: criticalIssues.length ? 'CRÍTICA' : 'VERIFICAÇÃO PARCIAL', message: 'Saúde baseada em evidências disponíveis; componentes sem medição permanecem sem dados.', criticalIssues, attentionIssues: ['Web, Reader, Auth e storage exigem medições recentes para certificação.'], trend24h: 'Sem série histórica', trend7d: 'Sem série histórica' },
      components: {
        database, importer,
        web: component('web', 'Web & Desktop', 'Globe'),
        mobile: component('mobile', 'Experiência Mobile', 'Smartphone'),
        storage: component('storage', 'Manga Storage', 'HardDrive', { 'Shards habilitados': raw?.storage?.total_enabled_shards ?? missing }),
        sources: component('sources', 'Fontes de Mídia', 'Layers', { 'Ativas cadastradas': raw?.sources?.active ?? missing, 'Bloqueadas': raw?.sources?.blocked ?? missing }),
        auth: component('auth', 'Autenticação & Sessões', 'ShieldCheck'),
        reader: component('reader', 'Reader', 'BookOpen'),
        postgrest: component('postgrest', 'API / PostgREST', 'Zap'),
        emails: component('emails', 'Serviço de Emails', 'Mail', { 'Pendentes': raw?.emails?.pending ?? missing, 'Falhas': raw?.emails?.failed ?? missing }),
        readiness: component('readiness', 'Capacidade & Expansão', 'TrendingUp')
      },
      slowQueries: raw?.slow_queries || [], incidents: [], fetchedAt: new Date().toISOString()
    };
    cached = { at: Date.now(), payload };
    return payload;
  })();
  try { return await flight; } finally { flight = null; }
};
