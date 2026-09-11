<script lang="ts">
  import { action } from '$lib/actions';
  import {
    Settings,
    Database,
    Cloud,
    Shield,
    CheckCircle2,
    AlertCircle,
    Server,
    HardDrive,
    Globe,
    Lock,
    Save,
    Loader2,
    X
  } from '@lucide/svelte';

  let { data } = $props();

  let notice = $state('');
  let savingKey = $state('');

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const f = new FormData(event.currentTarget as HTMLFormElement);
    const key = String(f.get('key'));
    savingKey = key;
    try {
      await action('owner', 'setting', { key, value: f.get('value') });
      notice = 'Configuração salva com sucesso.';
      setTimeout(() => {
        if (notice === 'Configuração salva com sucesso.') notice = '';
      }, 3500);
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      savingKey = '';
    }
  }

  function getSettingLabel(key: string): { title: string; desc: string; placeholder: string } {
    switch (key) {
      case 'site_name':
        return {
          title: 'Nome da Plataforma',
          desc: 'Identificador exibido no título das abas, cabeçalho e metadados SEO.',
          placeholder: 'Project Nox Manga'
        };
      case 'description':
        return {
          title: 'Descrição Pública (SEO)',
          desc: 'Texto de apresentação para buscadores e compartilhamentos OpenGraph.',
          placeholder: 'A leitura cósmica de mangás e manhwas do Project Nox.'
        };
      case 'contact_email':
        return {
          title: 'E-mail Oficial de Contato',
          desc: 'Canal de suporte ao leitor e contato institucional da equipe.',
          placeholder: 'contato@project-nox.com'
        };
      default:
        return {
          title: key,
          desc: 'Parâmetro de configuração do sistema.',
          placeholder: ''
        };
    }
  }
</script>

<svelte:head>
  <title>Configurações — Nox Admin</title>
</svelte:head>

<div class="config-view">
  <!-- Header -->
  <header class="page-header">
    <span class="eyebrow">SISTEMA & PREFERÊNCIAS</span>
    <h1>Configurações da Plataforma</h1>
    <p class="subtitle">
      Ajuste parâmetros editoriais públicos e monitore o estado operacional de todos os subsistemas integrados.
    </p>
  </header>

  {#if notice}
    <div class="notice-banner" role="status">
      <CheckCircle2 size={16} />
      <span>{notice}</span>
      <button type="button" class="close-notice" onclick={() => (notice = '')}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <div class="config-grid">
    <!-- Left Column: Site Info Settings -->
    <div class="settings-column">
      <section class="panel">
        <div class="panel-header">
          <Globe size={18} class="panel-icon" />
          <h2>Identidade e Informações Públicas</h2>
        </div>

        <div class="settings-forms-stack">
          {#each data.settings as setting (setting.key)}
            {@const meta = getSettingLabel(setting.key)}
            <form onsubmit={save} class="setting-item-form">
              <input type="hidden" name="key" value={setting.key} />
              
              <div class="setting-info">
                <label for={`setting-${setting.key}`} class="setting-title">
                  {meta.title}
                </label>
                <p class="setting-desc">{meta.desc}</p>
              </div>

              <div class="setting-input-row">
                {#if setting.key === 'description'}
                  <textarea
                    id={`setting-${setting.key}`}
                    name="value"
                    rows="3"
                    maxlength="2000"
                    class="control textarea-control"
                    placeholder={meta.placeholder}
                  >{setting.value}</textarea>
                {:else}
                  <input
                    id={`setting-${setting.key}`}
                    name="value"
                    value={setting.value}
                    maxlength="2000"
                    class="control"
                    placeholder={meta.placeholder}
                  />
                {/if}

                <button
                  type="submit"
                  class="button secondary compact save-btn"
                  disabled={savingKey === setting.key}
                >
                  {#if savingKey === setting.key}
                    <Loader2 size={13} class="spin" />
                    <span>Salvando…</span>
                  {:else}
                    <Save size={13} />
                    <span>Salvar</span>
                  {/if}
                </button>
              </div>
            </form>
          {/each}
        </div>
      </section>
    </div>

    <!-- Right Column: Operational Integrations Status -->
    <div class="integrations-column">
      <section class="panel">
        <div class="panel-header">
          <Server size={18} class="panel-icon" />
          <h2>Status Operacional das Conexões</h2>
        </div>

        <div class="security-guarantee-note">
          <Lock size={14} />
          <span>
            Arquitetura segura: Credenciais e segredos operam exclusivamente em runtime de servidor protegido e não são expostos.
          </span>
        </div>

        <div class="integrations-stack">
          <!-- Supabase DB & Auth -->
          <div class="integration-card">
            <div class="integration-card-top">
              <div class="integration-identity">
                <Database size={16} class="integration-icon" />
                <div>
                  <strong>Banco de Dados & Auth SSR</strong>
                  <span class="provider-name">PostgreSQL / Supabase</span>
                </div>
              </div>
              <span class="status-pill connected">
                <span class="dot-connected"></span>
                Conectado
              </span>
            </div>
            <p class="small muted">
              Autenticação segura via cookies HTTP-only assinados e isolamento via Row-Level Security (RLS).
            </p>
          </div>

          <!-- Telegram Storage -->
          <div class="integration-card">
            <div class="integration-card-top">
              <div class="integration-identity">
                <HardDrive size={16} class="integration-icon" />
                <div>
                  <strong>Armazenamento de Mídia</strong>
                  <span class="provider-name">{data.telegram ? 'Telegram Bot CDN' : 'Supabase Storage'}</span>
                </div>
              </div>
              <span class="status-pill connected">
                <span class="dot-connected"></span>
                {data.telegram ? 'Configurado' : 'Padrão Ativo'}
              </span>
            </div>
            <p class="small muted">
              Entrega de páginas e capas com reserva de quota gratuita R$ 0,00. Nenhuma cobrança ativada automaticamente.
            </p>
          </div>

          <!-- Staff Bridge -->
          <div class="integration-card">
            <div class="integration-card-top">
              <div class="integration-identity">
                <Shield size={16} class="integration-icon" />
                <div>
                  <strong>Central da Staff (Project Nox)</strong>
                  <span class="provider-name">Bridge Editorial Unidirecional</span>
                </div>
              </div>
              {#if data.staff}
                <span class="status-pill connected">
                  <span class="dot-connected"></span>
                  Conectada
                </span>
              {:else}
                <span class="status-pill pending">
                  <span class="dot-pending"></span>
                  Pendente
                </span>
              {/if}
            </div>
            <p class="small muted">
              Bridge estritamente de leitura. Apenas arquivos finais aprovados na revisão da Staff podem ser consultados.
            </p>
          </div>

          <!-- Cloudflare Workers -->
          <div class="integration-card">
            <div class="integration-card-top">
              <div class="integration-identity">
                <Cloud size={16} class="integration-icon" />
                <div>
                  <strong>Edge Network & Roteamento</strong>
                  <span class="provider-name">Cloudflare Workers</span>
                </div>
              </div>
              <span class="status-pill connected">
                <span class="dot-connected"></span>
                Ativo
              </span>
            </div>
            <p class="small muted">
              SSR executado em borda global com latência mínima e proteção contra tráfego malicioso.
            </p>
          </div>
        </div>
      </section>

      <!-- Storage Supremo Infrastructure Section -->
      {#if data.storageShards && data.storageShards.length > 0}
        <section class="panel storage-panel">
          <div class="panel-header storage-header">
            <div class="header-left">
              <HardDrive size={18} class="panel-icon" />
              <h2>Storage Supremo — Infraestrutura Multi-Bot e Multi-Shard</h2>
            </div>
            <span class="status-pill connected">
              <span class="dot-connected"></span>
              {data.storageShards.filter(s => s.enabled && s.write_status === 'HEALTHY').length}/{data.storageShards.length} Shards Saudáveis
            </span>
          </div>
          <p class="section-desc">
            Topologia distribuída com isolamento estrito por pool, bot affinity, failover automático e circuit breakers de escrita independentes da leitura.
          </p>

          <div class="shards-table-container">
            <table class="shards-table">
              <thead>
                <tr>
                  <th>Shard Físico</th>
                  <th>Pool Canônico</th>
                  <th>Bot Reference</th>
                  <th>Canal Telegram</th>
                  <th>Escrita</th>
                  <th>Leitura</th>
                  <th>Conexões</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                {#each data.storageShards as shard}
                  <tr>
                    <td>
                      <div class="shard-name-cell">
                        <strong class="shard-name">{shard.display_name}</strong>
                        {#if shard.reserved}
                          <span class="badge-reserved">Reservado</span>
                        {/if}
                      </div>
                    </td>
                    <td>
                      <span class="pool-tag">{data.storagePools.find(p => p.id === shard.pool_id)?.display_name || 'Pool'}</span>
                    </td>
                    <td><code class="code-ref">{shard.bot_reference}</code></td>
                    <td><code class="code-ref">{shard.channel_id}</code></td>
                    <td>
                      <span class="status-chip {shard.write_status.toLowerCase()}">
                        {shard.write_status}
                      </span>
                    </td>
                    <td>
                      <span class="status-chip {shard.read_status.toLowerCase()}">
                        {shard.read_status}
                      </span>
                    </td>
                    <td><span class="connections-count">{shard.active_uploads} ativos</span></td>
                    <td><span class="weight-cell">{shard.weight}</span></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .config-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    color: #f8fafc;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.28);
    color: #a7f3d0;
    font-size: 13px;
  }

  .close-notice {
    margin-left: auto;
    background: transparent;
    border: 0;
    color: #6ee7b7;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .config-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .config-grid {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 14px;
    padding: 24px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid #1c1527;
  }

  :global(.panel-icon) {
    color: var(--purple, #a78bfa);
  }

  .panel-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #f8fafc;
  }

  /* Settings forms */
  .settings-forms-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-item-form {
    background: #090610;
    border: 1px solid #1e152d;
    border-radius: 10px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .setting-desc {
    font-size: 11px;
    color: var(--muted);
    margin: 0;
  }

  .setting-input-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .control {
    flex: 1;
    background: #120b1e;
    border: 1px solid #2d1f42;
    border-radius: 8px;
    padding: 9px 12px;
    color: #f8fafc;
    font-size: 13px;
  }

  .control:focus {
    outline: none;
    border-color: #9333ea;
  }

  .textarea-control {
    resize: vertical;
    min-height: 70px;
    line-height: 1.5;
  }

  .save-btn {
    white-space: nowrap;
    height: 38px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Integrations */
  .security-guarantee-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 11px;
    color: #d8b4fe;
    line-height: 1.4;
    margin-bottom: 16px;
  }

  .integrations-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .integration-card {
    background: #090610;
    border: 1px solid #1e152d;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .integration-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .integration-identity {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  :global(.integration-icon) {
    color: var(--purple, #a78bfa);
  }

  .integration-identity strong {
    font-size: 13px;
    color: #f1f5f9;
    display: block;
  }

  .provider-name {
    font-size: 11px;
    color: var(--muted);
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 999px;
  }

  .status-pill.connected {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .status-pill.pending {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .dot-connected {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .dot-pending {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }

  /* Storage Supremo Panel */
  .storage-panel {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .storage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-desc {
    font-size: 12px;
    color: var(--muted);
    margin: 0;
    line-height: 1.4;
  }

  .shards-table-container {
    overflow-x: auto;
    border: 1px solid #1e152d;
    border-radius: 10px;
    background: #090610;
  }

  .shards-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .shards-table th {
    background: #110d1a;
    padding: 10px 14px;
    color: #94a3b8;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #1e152d;
    white-space: nowrap;
  }

  .shards-table td {
    padding: 10px 14px;
    border-bottom: 1px solid #181124;
    color: #e2e8f0;
    white-space: nowrap;
  }

  .shards-table tbody tr:last-child td {
    border-bottom: none;
  }

  .shards-table tbody tr:hover {
    background: rgba(168, 85, 247, 0.04);
  }

  .shard-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shard-name {
    color: #f1f5f9;
    font-weight: 600;
  }

  .badge-reserved {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    font-weight: 600;
  }

  .pool-tag {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .code-ref {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: #a5b4fc;
    background: #140e24;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #231b38;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-chip.healthy {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-chip.cooldown {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-chip.offline,
  .status-chip.error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .connections-count {
    font-size: 11px;
    color: #94a3b8;
  }

  .weight-cell {
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
  }
</style>
