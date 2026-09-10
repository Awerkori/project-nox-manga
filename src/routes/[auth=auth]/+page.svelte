<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    Sparkles,
    BookOpen,
    Download,
    Trophy,
    Bell,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Lock,
    User,
    AtSign,
    Mail,
    ArrowRight
  } from '@lucide/svelte';

  let { data, form } = $props();
  let busy = $state(false);
  let showPassword = $state(false);
  let capsLockOn = $state(false);

  // Signup fields
  let displayName = $state('');
  let username = $state('');
  let usernameStatus = $state<'idle' | 'checking' | 'available' | 'error'>('idle');
  let usernameMessage = $state('');
  let checkTimer: any = null;

  let title = $derived(
    {
      entrar: 'Bom ter você de volta.',
      cadastrar: 'Seu próximo capítulo.',
      recuperar: 'Vamos recuperar seu acesso.',
      redefinir: 'Uma nova senha.'
    }[data.mode]
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.getModifierState) {
      capsLockOn = e.getModifierState('CapsLock');
    }
  }

  function onUsernameInput(e: Event) {
    const target = e.target as HTMLInputElement;
    // Force lowercase and strip forbidden chars in UI
    const sanitized = target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    username = sanitized;
    target.value = sanitized;

    if (checkTimer) clearTimeout(checkTimer);

    if (!sanitized) {
      usernameStatus = 'idle';
      usernameMessage = '';
      return;
    }

    if (sanitized.length < 3) {
      usernameStatus = 'error';
      usernameMessage = 'Mínimo de 3 caracteres.';
      return;
    }

    usernameStatus = 'checking';
    usernameMessage = 'Verificando...';

    checkTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(sanitized)}`);
        const json = await res.json();
        if (json.available) {
          usernameStatus = 'available';
          usernameMessage = `@${sanitized} está disponível!`;
        } else {
          usernameStatus = 'error';
          usernameMessage = json.reason || 'Nome indisponível.';
        }
      } catch {
        usernameStatus = 'error';
        usernameMessage = 'Erro ao verificar disponibilidade.';
      }
    }, 280);
  }
</script>

<svelte:head>
  <title>{title} — Project Nox</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="auth-page-wrapper">
  <div class="auth-grid-container">
    <!-- Left: Branding & Platform Perks -->
    <aside class="auth-branding-col">
      <div class="brand-pill">
        <Sparkles size={14} />
        <span>PROJECT NOX COMMUNITY</span>
      </div>

      <h1 class="brand-headline">
        Sua história<br />
        também faz<br />
        <span class="gradient-text">parte daqui.</span>
      </h1>

      <p class="brand-subtext">
        Uma experiência definitiva de leitura digital, feita de leitores para leitores, com autonomia,
        customização total e performance extrema.
      </p>

      <!-- Platform Perks List -->
      <div class="platform-perks-list">
        <div class="perk-item">
          <div class="perk-icon-wrap">
            <BookOpen size={18} />
          </div>
          <div class="perk-content">
            <h4 class="perk-title">Progresso em Nuvem</h4>
            <p class="perk-desc">Continue de onde parou em qualquer dispositivo sem perder suas páginas lidas.</p>
          </div>
        </div>

        <div class="perk-item">
          <div class="perk-icon-wrap">
            <Trophy size={18} />
          </div>
          <div class="perk-content">
            <h4 class="perk-title">Economia Cósmica & Cosméticos</h4>
            <p class="perk-desc">Acumule XP lendo capítulos e desbloqueie molduras animadas, títulos e cores.</p>
          </div>
        </div>

        <div class="perk-item">
          <div class="perk-icon-wrap">
            <Download size={18} />
          </div>
          <div class="perk-content">
            <h4 class="perk-title">Leitura Offline Rápida</h4>
            <p class="perk-desc">Baixe obras completas em segundos para ler mesmo sem conexão de internet.</p>
          </div>
        </div>

        <div class="perk-item">
          <div class="perk-icon-wrap">
            <Bell size={18} />
          </div>
          <div class="perk-content">
            <h4 class="perk-title">Notificações em Tempo Real</h4>
            <p class="perk-desc">Receba avisos instantâneos quando suas obras favoritas lançarem novos capítulos.</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right: Auth Glass Form Card -->
    <main class="auth-form-col">
      <section class="auth-card-glass">
        <header class="auth-card-header">
          <h2 class="auth-card-title">{title}</h2>
          <p class="auth-card-subtitle">
            {#if data.mode === 'entrar'}
              Entre com suas credenciais para continuar sua jornada na Nox.
            {:else if data.mode === 'cadastrar'}
              Crie sua conta gratuita em segundos e garanta seu @username exclusivo.
            {:else if data.mode === 'recuperar'}
              Informe seu e-mail cadastrado e enviaremos instruções de recuperação.
            {:else}
              Defina sua nova senha de acesso com segurança.
            {/if}
          </p>
        </header>

        {#if form?.message || data.error}
          <div
            class="auth-alert"
            class:success={form?.success}
            class:error={!form?.success}
            role="status"
          >
            {#if form?.success}
              <CheckCircle2 size={18} class="alert-icon" />
            {:else}
              <AlertCircle size={18} class="alert-icon" />
            {/if}
            <div class="alert-text">{form?.message || data.error}</div>
          </div>
        {/if}

        <form
          method="POST"
          use:enhance={() => {
            busy = true;
            return async ({ update }) => {
              try {
                await update();
              } finally {
                busy = false;
              }
            };
          }}
          class="auth-form-body"
        >
          {#if data.mode === 'cadastrar'}
            <!-- Display Name -->
            <div class="form-group">
              <label for="displayName" class="input-label">
                <User size={15} />
                <span>Nome de Exibição</span>
              </label>
              <div class="input-wrap">
                <input
                  id="displayName"
                  type="text"
                  name="displayName"
                  bind:value={displayName}
                  required
                  minlength="2"
                  maxlength="50"
                  autocomplete="name"
                  placeholder="Ex: Amanda Silva ou Aventureiro Nox"
                  class="custom-input"
                />
              </div>
              <span class="field-hint">Como você será chamado publicamente na comunidade.</span>
            </div>

            <!-- Username (@) with real-time verification -->
            <div class="form-group">
              <div class="label-row">
                <label for="username" class="input-label">
                  <AtSign size={15} />
                  <span>Nome de Usuário (@)</span>
                </label>
                {#if usernameStatus === 'checking'}
                  <span class="status-indicator checking">
                    <Loader2 size={13} class="spin-icon" />
                    <span>Verificando...</span>
                  </span>
                {:else if usernameStatus === 'available'}
                  <span class="status-indicator available">
                    <CheckCircle2 size={13} />
                    <span>Disponível</span>
                  </span>
                {:else if usernameStatus === 'error'}
                  <span class="status-indicator error">
                    <AlertCircle size={13} />
                    <span>{usernameMessage}</span>
                  </span>
                {/if}
              </div>

              <div class="input-wrap has-prefix">
                <span class="input-prefix">@</span>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={username}
                  oninput={onUsernameInput}
                  required
                  minlength="3"
                  maxlength="30"
                  pattern="[a-z0-9_]+"
                  autocomplete="username"
                  placeholder="seu_nome_usuario"
                  class="custom-input with-prefix"
                  class:valid={usernameStatus === 'available'}
                  class:invalid={usernameStatus === 'error'}
                />
              </div>
              <span class="field-hint">De 3 a 30 caracteres minúsculos, números e sublinhados (_).</span>
            </div>
          {/if}

          {#if data.mode !== 'redefinir'}
            <!-- Email -->
            <div class="form-group">
              <label for="email" class="input-label">
                <Mail size={15} />
                <span>E-mail</span>
              </label>
              <div class="input-wrap">
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  maxlength="254"
                  autocomplete="email"
                  placeholder="voce@exemplo.com"
                  class="custom-input"
                />
              </div>
            </div>
          {/if}

          {#if data.mode !== 'recuperar'}
            <!-- Password -->
            <div class="form-group">
              <div class="label-row">
                <label for="password" class="input-label">
                  <Lock size={15} />
                  <span>{data.mode === 'redefinir' ? 'Nova Senha' : 'Senha'}</span>
                </label>
                {#if capsLockOn}
                  <span class="caps-warning">
                    <AlertCircle size={12} />
                    <span>Fixa / Caps Lock Ativo</span>
                  </span>
                {/if}
              </div>

              <div class="input-wrap has-suffix">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minlength="10"
                  maxlength="128"
                  onkeydown={handleKeydown}
                  autocomplete={data.mode === 'entrar' ? 'current-password' : 'new-password'}
                  placeholder={data.mode === 'cadastrar' ? 'Mínimo de 10 caracteres seguros' : 'Sua senha'}
                  class="custom-input with-suffix"
                />
                <button
                  type="button"
                  class="btn-toggle-password"
                  onclick={() => (showPassword = !showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  tabindex="-1"
                >
                  {#if showPassword}
                    <EyeOff size={17} />
                  {:else}
                    <Eye size={17} />
                  {/if}
                </button>
              </div>

              {#if data.mode === 'cadastrar'}
                <span class="field-hint">Pelo menos 10 caracteres. Dica: use letras e números misturados.</span>
              {/if}
            </div>
          {/if}

          {#if data.mode === 'entrar'}
            <div class="forgot-row">
              <a class="forgot-link" href="/recuperar">Esqueci minha senha</a>
            </div>
          {/if}

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn-submit-auth"
            disabled={busy || (data.mode === 'cadastrar' && usernameStatus === 'error')}
          >
            {#if busy}
              <Loader2 size={18} class="spin-icon" />
              <span>Processando...</span>
            {:else if data.mode === 'entrar'}
              <span>Entrar na Nox</span>
              <ArrowRight size={17} />
            {:else if data.mode === 'cadastrar'}
              <span>Criar Conta & Fazer Parte</span>
              <ArrowRight size={17} />
            {:else if data.mode === 'recuperar'}
              <span>Enviar Link de Recuperação</span>
              <ArrowRight size={17} />
            {:else}
              <span>Salvar Nova Senha</span>
              <ArrowRight size={17} />
            {/if}
          </button>
        </form>

        <!-- Mode Switcher -->
        <footer class="auth-card-footer">
          {#if data.mode === 'entrar'}
            <p class="switch-text">
              Ainda não faz parte?
              <a href="/cadastrar" class="switch-link">Crie sua conta gratuita</a>
            </p>
          {:else}
            <p class="switch-text">
              Já possui uma conta?
              <a href="/entrar" class="switch-link">Voltar para o login</a>
            </p>
          {/if}

          <p class="privacy-note">
            Seu e-mail permanece confidencial e nunca é exibido publicamente.
            <a href="/privacidade" class="privacy-link">Termos & Privacidade</a>
          </p>
        </footer>
      </section>
    </main>
  </div>
</div>

<style>
  .auth-page-wrapper {
    min-height: calc(100vh - 80px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    color: #f1f5f9;
  }

  .auth-grid-container {
    max-width: 1160px;
    width: 100%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 4.5rem;
    align-items: center;
  }

  /* Left Branding Column */
  .auth-branding-col {
    display: flex;
    flex-direction: column;
  }

  .brand-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    color: #c4b5fd;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 1.25rem;
    width: fit-content;
  }

  .brand-headline {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 3.2rem;
    font-weight: 800;
    line-height: 1.12;
    color: #ffffff;
    margin: 0 0 1.25rem;
    letter-spacing: -0.025em;
  }

  .gradient-text {
    background: linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #dfc28d 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand-subtext {
    font-size: 1.05rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 2.5rem;
    max-width: 480px;
  }

  .platform-perks-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .perk-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .perk-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    flex-shrink: 0;
  }

  .perk-content {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .perk-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .perk-desc {
    font-size: 0.82rem;
    color: #64748b;
    line-height: 1.45;
    margin: 0;
  }

  /* Right Glass Card */
  .auth-form-col {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .auth-card-glass {
    width: 100%;
    max-width: 460px;
    background: rgba(18, 17, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.5rem;
    box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(139, 92, 246, 0.1);
    backdrop-filter: blur(16px);
  }

  .auth-card-header {
    margin-bottom: 1.75rem;
  }

  .auth-card-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
    letter-spacing: -0.015em;
  }

  .auth-card-subtitle {
    font-size: 0.88rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  /* Alerts */
  .auth-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    font-size: 0.86rem;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .auth-alert.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .auth-alert.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  :global(.alert-icon) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Form Elements */
  .auth-form-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .input-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.84rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-indicator.checking {
    color: #94a3b8;
  }

  .status-indicator.available {
    color: #10b981;
  }

  .status-indicator.error {
    color: #ef4444;
  }

  .caps-warning {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #f59e0b;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .custom-input {
    width: 100%;
    padding: 0.8rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.92rem;
    transition: all 0.2s ease;
    font-family: inherit;
    outline: none;
  }

  .custom-input:focus {
    border-color: #8b5cf6;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  }

  .input-wrap.has-prefix .input-prefix {
    position: absolute;
    left: 1rem;
    color: #64748b;
    font-weight: 700;
    font-size: 0.92rem;
    pointer-events: none;
  }

  .custom-input.with-prefix {
    padding-left: 2rem;
  }

  .custom-input.with-suffix {
    padding-right: 2.75rem;
  }

  .custom-input.valid {
    border-color: rgba(16, 185, 129, 0.5);
  }

  .custom-input.invalid {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .btn-toggle-password {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: #64748b;
    padding: 0.4rem;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .btn-toggle-password:hover {
    color: #cbd5e1;
  }

  .field-hint {
    font-size: 0.75rem;
    color: #64748b;
    line-height: 1.4;
  }

  .forgot-row {
    display: flex;
    justify-content: flex-end;
    margin-top: -0.25rem;
  }

  .forgot-link {
    font-size: 0.8rem;
    color: #c4b5fd;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }

  .forgot-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  /* Submit Button */
  .btn-submit-auth {
    width: 100%;
    margin-top: 0.75rem;
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35);
    transition: all 0.2s ease;
  }

  .btn-submit-auth:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    box-shadow: 0 6px 25px rgba(124, 58, 237, 0.5);
    transform: translateY(-1px);
  }

  .btn-submit-auth:disabled {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.05);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  /* Footer */
  .auth-card-footer {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .switch-text {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .switch-link {
    color: #c4b5fd;
    font-weight: 700;
    text-decoration: none;
    transition: color 0.2s;
  }

  .switch-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  .privacy-note {
    font-size: 0.74rem;
    color: #475569;
    line-height: 1.5;
    margin: 0;
  }

  .privacy-link {
    color: #64748b;
    text-decoration: none;
  }

  .privacy-link:hover {
    color: #94a3b8;
    text-decoration: underline;
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive Breakpoints */
  @media (max-width: 960px) {
    .auth-grid-container {
      grid-template-columns: 1fr;
      gap: 3rem;
    }

    .auth-branding-col {
      text-align: center;
      align-items: center;
    }

    .brand-headline {
      font-size: 2.4rem;
    }

    .platform-perks-list {
      display: none;
    }
  }

  @media (max-width: 500px) {
    .auth-page-wrapper {
      padding: 1.5rem 1rem;
    }

    .auth-card-glass {
      padding: 1.75rem 1.25rem;
    }

    .brand-headline {
      font-size: 2rem;
    }
  }
</style>

