<script lang="ts">
  import {
    Trophy,
    Calendar,
    Clock,
    Users,
    ShieldCheck,
    AlertTriangle,
    RotateCcw,
    X,
    Sparkles,
    CheckCircle2,
    Lock
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let showResetModal = $state(false);
  let confirmationInput = $state('');
  let isResetting = $state(false);
  let statusNotice = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Time calculations
  let seasonEndTime = $derived(new Date(data.season?.ends_at || '2026-12-31T23:59:59.000Z').getTime());
  let daysLeft = $derived(Math.max(0, Math.floor((seasonEndTime - Date.now()) / (1000 * 60 * 60 * 24))));
  let hoursLeft = $derived(Math.max(0, Math.floor(((seasonEndTime - Date.now()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))));

  function formatDate(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoStr;
    }
  }

  function formatDateTime(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  function formatNumber(num: number) {
    return Number(num || 0).toLocaleString('pt-BR');
  }

  async function handleResetSeason() {
    if (confirmationInput !== 'RESETAR XP' || isResetting) return;

    isResetting = true;
    statusNotice = null;

    try {
      const res = await fetch('/api/admin/rankings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmationInput })
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        statusNotice = {
          type: 'error',
          message: result.error || 'Erro ao redefinir temporada.'
        };
      } else {
        statusNotice = {
          type: 'success',
          message: `Temporada redefinida com sucesso! Nova temporada criada (${result.next_season}).`
        };
        showResetModal = false;
        confirmationInput = '';
        await invalidateAll();
      }
    } catch (err) {
      statusNotice = {
        type: 'error',
        message: (err as Error).message || 'Erro de comunicação com o servidor.'
      };
    } finally {
      isResetting = false;
    }
  }
</script>

<svelte:head>
  <title>Rankings & Temporadas — Administração — Project Nox</title>
</svelte:head>

<div class="admin-page-container">
  <!-- Page Header -->
  <header class="admin-page-header">
    <div class="header-icon-wrap">
      <Trophy size={28} />
    </div>
    <div class="header-title-wrap">
      <h1 class="admin-title">Rankings & Temporadas Cósmicas</h1>
      <p class="admin-subtitle">
        Controle de ciclos trimestrais de 90 dias, estatísticas em tempo real, regras de progressão e auditoria de resets.
      </p>
    </div>
  </header>

  <!-- Status Alert Messages -->
  {#if statusNotice}
    <div class="status-banner" class:success={statusNotice.type === 'success'} class:error={statusNotice.type === 'error'}>
      {#if statusNotice.type === 'success'}
        <CheckCircle2 size={18} />
      {:else}
        <AlertTriangle size={18} />
      {/if}
      <span>{statusNotice.message}</span>
      <button type="button" class="btn-dismiss-alert" onclick={() => (statusNotice = null)}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- Metrics Grid -->
  <div class="metrics-grid">
    <!-- Active Season Card -->
    <div class="metric-card active-season-card">
      <div class="metric-card-top">
        <span class="metric-badge-live">
          <span class="live-dot" aria-hidden="true"></span>
          ATIVA
        </span>
        <span class="metric-label">Temporada Vigente</span>
      </div>
      <h2 class="metric-main-value">{data.season.name}</h2>
      <div class="season-timeline">
        <div class="timeline-item">
          <Calendar size={14} />
          <span>{formatDate(data.season.starts_at)} — {formatDate(data.season.ends_at)}</span>
        </div>
        <div class="timeline-item time-remaining">
          <Clock size={14} />
          <span><strong>{daysLeft}d {hoursLeft}h</strong> restantes</span>
        </div>
      </div>
    </div>

    <!-- Seasonal Competitors -->
    <div class="metric-card">
      <div class="metric-card-top">
        <Users size={18} class="card-icon-purple" />
        <span class="metric-label">Leitores Ativos na Temporada</span>
      </div>
      <div class="metric-num-big">{formatNumber(data.metrics.activeSeasonalMembers)}</div>
      <p class="metric-subtext">
        <strong>{formatNumber(data.metrics.totalSeasonXp)} XP</strong> disputados nesta temporada
      </p>
    </div>

    <!-- Security & Immutable Stats -->
    <div class="metric-card immunity-card">
      <div class="metric-card-top">
        <ShieldCheck size={18} class="card-icon-green" />
        <span class="metric-label">Segurança da Economia</span>
      </div>
      <div class="metric-num-big immunity-val">100% Protegido</div>
      <p class="metric-subtext">
        {formatNumber(data.metrics.totalLifetimeXp)} Lifetime XP e {formatNumber(data.metrics.totalInventoryItems)} cosméticos imunes a reset
      </p>
    </div>
  </div>

  <!-- Top 3 Contenders on Current Podium -->
  <section class="admin-section-card">
    <div class="section-card-header">
      <div class="header-left">
        <Sparkles size={18} class="sparkle-gold" />
        <h3>Líderes do Pódio (Candidatos ao Hall da Fama)</h3>
      </div>
      <span class="section-tag">Temporada {data.season.number}</span>
    </div>

    {#if data.metrics.topContenders && data.metrics.topContenders.length > 0}
      <div class="top-contenders-row">
        {#each data.metrics.topContenders as contender, idx}
          <div class="contender-box place-{idx + 1}">
            <div class="contender-rank-pill">
              {#if idx === 0}👑 1º Lugar{:else if idx === 1}🥈 2º Lugar{:else if idx === 2}🥉 3º Lugar{:else}#{idx + 1}{/if}
            </div>
            <UserAvatar
              avatarId={contender.avatar_id}
              crop={contender.avatar_crop}
              displayName={contender.display_name}
              frameId={contender.avatar_frame_id}
              size={54}
            />
            <strong
              class="contender-name"
              style={contender.name_color ? `color: ${contender.name_color};` : ''}
            >
              {contender.display_name}
            </strong>
            <span class="contender-handle">@{contender.username}</span>
            <span class="contender-xp">{formatNumber(contender.season_xp)} XP</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty-text">Nenhum leitor pontuou nesta temporada ainda.</p>
    {/if}
  </section>

  <!-- Impact Preview Card -->
  <section class="admin-section-card impact-preview-card">
    <div class="section-card-header">
      <div class="header-left">
        <ShieldCheck size={18} class="card-icon-purple" />
        <h3>Prévia de Impacto do Reset de Temporada</h3>
      </div>
    </div>

    <div class="impact-columns">
      <div class="impact-col will-reset">
        <h4>O QUE É REDEFINIDO NO CICLO TRIMESTRAL:</h4>
        <ul>
          <li><strong>Season XP:</strong> Redefinido para 0 para todos os leitores ({formatNumber(data.metrics.activeSeasonalMembers)} membros).</li>
          <li><strong>Pódio e Tabela:</strong> Todos começam uma nova corrida competitiva do zero em igualdade de condições.</li>
          <li><strong>Hall da Fama:</strong> Os 3 primeiros colocados são arquivados para a posteridade com seus títulos e medalhas.</li>
        </ul>
      </div>

      <div class="impact-col will-preserve">
        <h4>O QUE NUNCA É RESETADO (100% PRESERVADO):</h4>
        <ul>
          <li><strong>Nível Permanente de Leitor:</strong> 100% INTACTO (baseado no Lifetime XP acumulado na vida inteira).</li>
          <li><strong>Saldo de XP da Loja Cósmica:</strong> 100% INTACTO (o usuário não perde moedas de compra).</li>
          <li><strong>Inventário de Cosméticos:</strong> 100% INTACTO (todas as molduras, títulos, banners e cores permanecem no inventário).</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Danger Zone Card -->
  <section class="admin-section-card danger-zone-card">
    <div class="section-card-header danger-header">
      <div class="header-left">
        <AlertTriangle size={18} class="card-icon-red" />
        <h3>Zona Crítica — Reset Manual da Temporada</h3>
      </div>
      <span class="lock-indicator">
        <Lock size={13} />
        Ação Protegida
      </span>
    </div>

    <p class="danger-description">
      Esta ação encerra a temporada ativa ({data.season.name}), arquiva os líderes no Hall da Fama e reinicia a pontuação sazonal para abrir um novo ciclo de 90 dias.
      Por segurança máxima, a confirmação exige digitação explícita.
    </p>

    <div class="danger-actions">
      <button
        type="button"
        class="btn-trigger-reset"
        onclick={() => (showResetModal = true)}
      >
        <RotateCcw size={16} />
        <span>Iniciar Reset da Temporada</span>
      </button>
    </div>
  </section>

  <!-- Audit Log Table -->
  <section class="admin-section-card">
    <div class="section-card-header">
      <div class="header-left">
        <Clock size={18} />
        <h3>Histórico de Resets de Temporada (Auditoria)</h3>
      </div>
      <span class="section-tag">{data.resets.length} registros</span>
    </div>

    {#if data.resets && data.resets.length > 0}
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Data e Hora</th>
              <th>Temporada</th>
              <th>Admin Responsável</th>
              <th style="text-align: center">Membros Afetados</th>
              <th style="text-align: right">Season XP Arquivado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {#each data.resets as reset}
              <tr>
                <td>{formatDateTime(reset.executed_at)}</td>
                <td><span class="season-id-pill">{reset.season_id}</span></td>
                <td>{reset.admin_email || 'Admin'}</td>
                <td style="text-align: center">{formatNumber(reset.total_members_reset)}</td>
                <td style="text-align: right" class="xp-val">{formatNumber(reset.total_season_xp_reset)} XP</td>
                <td class="notes-col">{reset.notes || '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="empty-text">Nenhum reset foi registrado ainda. A Temporada 1 é o primeiro ciclo oficial da plataforma.</p>
    {/if}
  </section>
</div>

<!-- Confirmation Modal -->
{#if showResetModal}
  <div class="modal-backdrop" onclick={() => (showResetModal = false)} role="dialog" aria-modal="true">
    <div class="modal-card modal-reset" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-header-title">
          <AlertTriangle size={22} class="card-icon-red" />
          <h2>Confirmar Reset da Temporada</h2>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={() => (showResetModal = false)}
        >
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <div class="modal-warning-box">
          <p>
            Você está prestes a redefinir a <strong>{data.season.name}</strong>.
          </p>
          <ul>
            <li>Todos os <strong>{formatNumber(data.metrics.activeSeasonalMembers)}</strong> leitores com pontuação terão seu Season XP zerado.</li>
            <li>O Hall da Fama registrará os 3 primeiros colocados.</li>
            <li><strong>Saldos de Loja e Níveis Permanentes NÃO serão afetados.</strong></li>
          </ul>
        </div>

        <label for="confirmation-field" class="confirmation-label">
          Para confirmar, digite exatamente <strong class="confirm-phrase">RESETAR XP</strong> no campo abaixo:
        </label>
        <input
          id="confirmation-field"
          type="text"
          class="confirmation-input"
          bind:value={confirmationInput}
          placeholder="RESETAR XP"
          autocomplete="off"
        />

        {#if statusNotice && statusNotice.type === 'error'}
          <div class="modal-error-alert">
            <AlertTriangle size={15} />
            <span>{statusNotice.message}</span>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn-cancel"
          onclick={() => { showResetModal = false; confirmationInput = ''; }}
          disabled={isResetting}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-confirm-reset"
          disabled={confirmationInput !== 'RESETAR XP' || isResetting}
          onclick={handleResetSeason}
        >
          {#if isResetting}
            <span>Processando Reset...</span>
          {:else}
            <span>Confirmar Reset da Temporada</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-page-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 20px 80px;
  }

  .admin-page-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .header-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(126, 34, 206, 0.3));
    border: 1px solid rgba(168, 85, 247, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c084fc;
    flex-shrink: 0;
  }

  .admin-title {
    font-size: 24px;
    font-weight: 900;
    color: #f8fafc;
    margin: 0 0 4px;
  }

  .admin-subtitle {
    font-size: 13.5px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  /* Status Banner */
  .status-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 13.5px;
    font-weight: 600;
  }

  .status-banner.success {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }

  .status-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .btn-dismiss-alert {
    margin-left: auto;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.8;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .metric-card {
    background: linear-gradient(135deg, rgba(20, 10, 36, 0.95), rgba(14, 8, 26, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 18px 20px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .metric-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .metric-badge-live {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 800;
    background: rgba(34, 197, 94, 0.18);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
  }

  .metric-label {
    font-size: 12px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .card-icon-purple {
    color: #c084fc;
  }

  .card-icon-green {
    color: #4ade80;
  }

  .card-icon-red {
    color: #f87171;
  }

  .metric-main-value {
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 12px;
  }

  .season-timeline {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    color: #cbd5e1;
  }

  .timeline-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .time-remaining {
    color: #fbbf24;
  }

  .metric-num-big {
    font-size: 26px;
    font-weight: 900;
    color: #f8fafc;
    margin: 4px 0;
  }

  .immunity-val {
    color: #4ade80;
  }

  .metric-subtext {
    font-size: 12px;
    color: #94a3b8;
    margin: 0;
  }

  .metric-subtext strong {
    color: #e2e8f0;
  }

  /* Admin Sections */
  .admin-section-card {
    background: linear-gradient(135deg, rgba(20, 10, 36, 0.95), rgba(12, 8, 22, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 20px 22px;
    margin-bottom: 24px;
  }

  .section-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left h3 {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .sparkle-gold {
    color: #fbbf24;
  }

  .section-tag {
    font-size: 11px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    padding: 2px 8px;
    border-radius: 6px;
  }

  /* Top Contenders */
  .top-contenders-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
  }

  .contender-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 16px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .contender-box.place-1 {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.06);
  }

  .contender-rank-pill {
    font-size: 11px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .contender-name {
    font-size: 14px;
    color: #f8fafc;
    margin-top: 8px;
  }

  .contender-handle {
    font-size: 11.5px;
    color: #64748b;
  }

  .contender-xp {
    font-size: 13px;
    font-weight: 800;
    color: #fbbf24;
    margin-top: 6px;
  }

  /* Impact Preview */
  .impact-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .impact-col {
    padding: 16px;
    border-radius: 10px;
    font-size: 13px;
  }

  .impact-col.will-reset {
    background: rgba(239, 68, 68, 0.07);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .impact-col.will-preserve {
    background: rgba(34, 197, 94, 0.07);
    border: 1px solid rgba(34, 197, 94, 0.25);
  }

  .impact-col h4 {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 0 0 10px;
  }

  .impact-col.will-reset h4 {
    color: #f87171;
  }

  .impact-col.will-preserve h4 {
    color: #4ade80;
  }

  .impact-col ul {
    margin: 0;
    padding-left: 18px;
    line-height: 1.6;
    color: #cbd5e1;
  }

  /* Danger Zone */
  .danger-zone-card {
    border-color: rgba(239, 68, 68, 0.35);
    background: linear-gradient(135deg, rgba(32, 12, 18, 0.95), rgba(18, 8, 12, 0.98));
  }

  .lock-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #f87171;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .danger-description {
    font-size: 13.5px;
    color: #cbd5e1;
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .btn-trigger-reset {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fca5a5;
    font-weight: 700;
    font-size: 13.5px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-trigger-reset:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: #ef4444;
    color: #fff;
  }

  /* Table */
  .table-wrap {
    overflow-x: auto;
  }

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .admin-table th {
    padding: 10px 14px;
    text-align: left;
    color: #64748b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
  }

  .admin-table td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: #e2e8f0;
  }

  .season-id-pill {
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 11.5px;
  }

  .xp-val {
    color: #fbbf24;
    font-weight: 700;
  }

  .notes-col {
    color: #94a3b8;
    font-size: 12px;
  }

  .empty-text {
    font-size: 13px;
    color: #94a3b8;
    text-align: center;
    padding: 20px 0;
    margin: 0;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-card.modal-reset {
    background: linear-gradient(135deg, rgba(28, 12, 18, 0.98), rgba(16, 8, 12, 0.98));
    border: 1px solid rgba(239, 68, 68, 0.45);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    padding: 24px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .modal-header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .modal-header-title h2 {
    font-size: 18px;
    font-weight: 800;
    color: #f87171;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .modal-warning-box {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .modal-warning-box ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }

  .confirmation-label {
    display: block;
    font-size: 13px;
    color: #e2e8f0;
    margin-bottom: 8px;
  }

  .confirm-phrase {
    color: #f87171;
    font-family: monospace;
    font-size: 14px;
  }

  .confirmation-input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #fff;
    font-family: monospace;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 16px;
  }

  .confirmation-input:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  }

  .modal-error-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 12.5px;
    margin-bottom: 16px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .btn-cancel {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-confirm-reset {
    padding: 8px 18px;
    background: #ef4444;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .btn-confirm-reset:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .impact-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
