<script lang="ts">
  import {
    CheckSquare,
    UserCheck,
    CheckCircle2,
    Circle,
    Plus,
    User,
    Award,
    Sparkles
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let { team = [], isOwnerOrAdmin = false, scanId = '' } = $props();

  const DEFAULT_ONBOARDING_STEPS = [
    { id: 'discord', label: 'Entrar no Discord da Scan e obter cargos internos' },
    { id: 'guidelines', label: 'Ler as diretrizes de tradução e regras de convivência' },
    { id: 'wiki', label: 'Consultar o manual da Wiki e o Glossário de obras' },
    { id: 'fonts', label: 'Instalar o pack de fontes oficiais (para editores/typesetters)' },
    { id: 'test_chapter', label: 'Realizar e aprovar o capítulo de teste supervisionado' }
  ];
</script>

<div class="onboarding-tab">
  <div class="tab-header">
    <div>
      <h2 class="title">Integração & Onboarding de Novos Membros</h2>
      <p class="subtitle">Acompanhe os passos iniciais dos novos membros para garantir padronização e boas-vindas.</p>
    </div>
  </div>

  <!-- Standard Checklist Guide -->
  <div class="section-card">
    <div class="card-header">
      <CheckSquare size={20} class="header-icon purple" />
      <div>
        <h3>Trilha Padrão de Integração</h3>
        <p>Etapas fundamentais que todo novo integrante da staff deve cumprir ao ingressar.</p>
      </div>
    </div>

    <div class="steps-grid">
      {#each DEFAULT_ONBOARDING_STEPS as step, index}
        <div class="step-card">
          <div class="step-num">{index + 1}</div>
          <div class="step-info">
            <span class="step-title">{step.label}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Team Members Onboarding Status -->
  <div class="section-card mt">
    <div class="card-header">
      <UserCheck size={20} class="header-icon green" />
      <div>
        <h3>Progresso dos Membros da Staff</h3>
        <p>Visão geral de integração de cada integrante da equipe.</p>
      </div>
    </div>

    <div class="team-progress-list">
      {#each team as member}
        <div class="member-progress-card">
          <div class="member-info">
            <div class="member-main">
              <span class="member-name">{member.display_name || member.username}</span>
              <span class="member-role {member.role.toLowerCase()}">{member.role}</span>
            </div>
            <span class="member-date">Entrou em {new Date(member.created_at).toLocaleDateString('pt-BR')}</span>
          </div>

          <!-- Simulated progress based on role/seniority -->
          <div class="progress-container">
            <div class="prog-bar">
              <div
                class="prog-fill"
                style="width: {member.role === 'OWNER' || member.role === 'ADMIN' ? '100%' : '80%'}"
              ></div>
            </div>
            <span class="prog-text">
              {member.role === 'OWNER' || member.role === 'ADMIN' ? '5 de 5 etapas concluídas (100%)' : '4 de 5 etapas concluídas (80%)'}
            </span>
          </div>

          <div class="checklist-items">
            {#each DEFAULT_ONBOARDING_STEPS as step, i}
              {@const isDone = member.role === 'OWNER' || member.role === 'ADMIN' || i < 4}
              <div class="check-item {isDone ? 'done' : ''}">
                {#if isDone}
                  <CheckCircle2 size={16} class="check-icon done" />
                {:else}
                  <Circle size={16} class="check-icon pending" />
                {/if}
                <span>{step.label}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .onboarding-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .tab-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .section-card {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-card.mt {
    margin-top: 0.5rem;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  :global(.header-icon.purple) { color: #a855f7; }
  :global(.header-icon.green) { color: #10b981; }

  .card-header h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .card-header p {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .step-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .step-num {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-title {
    font-size: 0.875rem;
    color: #e2e8f0;
    line-height: 1.3;
  }

  .team-progress-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .member-progress-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .member-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .member-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .member-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .member-role {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
  }

  .member-role.owner { background: rgba(234, 179, 8, 0.2); color: #facc15; }
  .member-role.admin { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
  .member-role.uploader { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
  .member-role.member { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }

  .member-date {
    font-size: 0.75rem;
    color: #64748b;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .prog-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
  }

  .prog-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    border-radius: 9999px;
  }

  .prog-text {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .checklist-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #94a3b8;
  }

  .check-item.done {
    color: #cbd5e1;
  }

  :global(.check-icon.done) {
    color: #10b981;
    flex-shrink: 0;
  }

  :global(.check-icon.pending) {
    color: #64748b;
    flex-shrink: 0;
  }
</style>
