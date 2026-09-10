<script lang="ts">
  import { Shield, ShieldCheck, Users, AlertTriangle, CheckCircle2, ArrowRight, Home } from '@lucide/svelte';

  let { data, form } = $props();

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador de Scan',
    UPLOADER: 'Uploader de Capítulos',
    MEMBER: 'Membro da Equipe',
    OWNER: 'Líder da Scan'
  };

  function formatTime(iso: string) {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
</script>

<svelte:head>
  <title>Convite de Scan — Project Nox</title>
</svelte:head>

<div class="invite-page">
  <div class="invite-card">
    {#if data.status === 'VALID' && data.invite}
      {@const scan = data.invite.scan as any}
      <!-- Header Banner if exists -->
      {#if scan.banner_id}
        <div class="scan-banner" style="background-image: url(/media/{scan.banner_id});"></div>
      {/if}

      <div class="card-content">
        <!-- Scan Logo -->
        <div class="logo-wrap">
          {#if scan.logo_id}
            <img src="/media/{scan.logo_id}" alt="Logo de {scan.name}" class="scan-logo-img" />
          {:else}
            <div class="scan-logo-fallback">
              <Users size={32} />
            </div>
          {/if}
        </div>

        <span class="invite-badge">CONVITE PARA EQUIPE</span>
        <h1 class="scan-name">
          {scan.name}
          {#if scan.is_official}
            <ShieldCheck size={20} class="official-icon" title="Scan Oficial Verificada" />
          {/if}
        </h1>

        {#if scan.description}
          <p class="scan-desc">{scan.description}</p>
        {/if}

        <div class="role-box">
          <span class="role-box-label">Cargo Proposto:</span>
          <strong class="role-box-name">{roleLabels[data.invite.role] || data.invite.role}</strong>
          <span class="role-box-sub">Você terá permissões de colaboração na biblioteca desta scan.</span>
        </div>

        {#if form?.message}
          <div class="error-banner">
            <AlertTriangle size={16} />
            <span>{form.message}</span>
          </div>
        {/if}

        <div class="action-footer">
          {#if data.user}
            <form method="POST" action="?/claim">
              <button type="submit" class="btn-claim">
                <CheckCircle2 size={18} />
                <span>Aceitar Convite e Entrar na Equipe</span>
              </button>
            </form>
          {:else}
            <a href="/entrar?redirect=/convite/{data.code}" class="btn-claim">
              <span>Entre na sua conta para Aceitar</span>
              <ArrowRight size={18} />
            </a>
          {/if}

          <span class="expires-hint">
            Válido até: {formatTime(data.invite.expiresAt)}
          </span>
        </div>
      </div>

    {:else if data.status === 'ALREADY_MEMBER'}
      <div class="card-content centered">
        <div class="status-icon-box success">
          <CheckCircle2 size={40} />
        </div>
        <h2 class="status-title">Você já é membro desta equipe!</h2>
        <p class="status-desc">Você já possui acesso de equipe na scan associada a este convite.</p>
        <div class="actions-group">
          <a href="/scan" class="btn-primary">
            <span>Acessar Painel da Scan</span>
            <ArrowRight size={16} />
          </a>
        </div>
      </div>

    {:else if data.status === 'ALREADY_USED'}
      <div class="card-content centered">
        <div class="status-icon-box warning">
          <AlertTriangle size={40} />
        </div>
        <h2 class="status-title">Convite já utilizado</h2>
        <p class="status-desc">Este link de convite é de uso único e já foi aceito anteriormente.</p>
        <a href="/" class="btn-secondary">
          <Home size={16} />
          <span>Voltar ao Início</span>
        </a>
      </div>

    {:else if data.status === 'EXPIRED'}
      <div class="card-content centered">
        <div class="status-icon-box warning">
          <AlertTriangle size={40} />
        </div>
        <h2 class="status-title">Convite expirado</h2>
        <p class="status-desc">O prazo deste convite expirou. Solicite um novo link aos administradores da scan.</p>
        <a href="/" class="btn-secondary">
          <Home size={16} />
          <span>Voltar ao Início</span>
        </a>
      </div>

    {:else if data.status === 'REVOKED'}
      <div class="card-content centered">
        <div class="status-icon-box error">
          <AlertTriangle size={40} />
        </div>
        <h2 class="status-title">Convite revogado</h2>
        <p class="status-desc">Este convite foi cancelado pela administração da scan.</p>
        <a href="/" class="btn-secondary">
          <Home size={16} />
          <span>Voltar ao Início</span>
        </a>
      </div>

    {:else}
      <div class="card-content centered">
        <div class="status-icon-box error">
          <AlertTriangle size={40} />
        </div>
        <h2 class="status-title">Convite não encontrado</h2>
        <p class="status-desc">O link informado é inválido ou não existe mais.</p>
        <a href="/" class="btn-secondary">
          <Home size={16} />
          <span>Voltar ao Início</span>
        </a>
      </div>
    {/if}
  </div>
</div>

<style>
  .invite-page {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
  }

  .invite-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    width: 100%;
    max-width: 520px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.15);
  }

  .scan-banner {
    height: 120px;
    background-size: cover;
    background-position: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-content {
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .card-content.centered {
    padding: 48px 28px;
  }

  .logo-wrap {
    margin-top: -64px;
    margin-bottom: 16px;
  }

  .scan-logo-img {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    object-fit: cover;
    border: 3px solid #0f121d;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .scan-logo-fallback {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, #1e1b4b, #312e81);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #0f121d;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .invite-badge {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #dfc28d;
    margin-bottom: 6px;
  }

  .scan-name {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 8px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  :global(.official-icon) {
    color: #60a5fa;
  }

  .scan-desc {
    font-size: 13.5px;
    color: #9d99ab;
    line-height: 1.5;
    margin: 0 0 20px;
    max-width: 420px;
  }

  .role-box {
    width: 100%;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 24px;
  }

  .role-box-label {
    font-size: 11px;
    font-weight: 700;
    color: #c4b5fd;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .role-box-name {
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
  }

  .role-box-sub {
    font-size: 12px;
    color: #8c899e;
  }

  .error-banner {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 13px;
    margin-bottom: 20px;
    text-align: left;
  }

  .action-footer {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-claim {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 12px;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    transition: all 0.2s ease;
  }

  .btn-claim:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(139, 92, 246, 0.55);
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
  }

  .expires-hint {
    font-size: 11px;
    color: #6c687e;
  }

  .status-icon-box {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .status-icon-box.success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-icon-box.warning {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .status-icon-box.error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 8px;
  }

  .status-desc {
    font-size: 13.5px;
    color: #8c899e;
    line-height: 1.5;
    margin: 0 0 24px;
    max-width: 380px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 10px;
    background: #8b5cf6;
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: #7c3aed;
    transform: translateY(-1px);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 13.5px;
    font-weight: 500;
    text-decoration: none;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
</style>
