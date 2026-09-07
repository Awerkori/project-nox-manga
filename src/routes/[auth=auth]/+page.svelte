<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
  let busy = $state(false);
  let title = $derived(
    {
      entrar: 'Bom ter você de volta.',
      cadastrar: 'Seu próximo capítulo.',
      recuperar: 'Vamos recuperar seu acesso.',
      redefinir: 'Uma nova senha.'
    }[data.mode]
  );
</script>

<svelte:head><title>{title} — Project Nox</title><meta name="robots" content="noindex" /></svelte:head>
<div class="auth-shell">
  <div class="auth-story">
    <span class="eyebrow">PROJECT NOX COMMUNITY</span>
    <h1>
      Sua história<br />também faz<br /><em style="color:var(--purple);font-style:normal">parte daqui.</em>
    </h1>
    <p>Uma biblioteca que acompanha você. Uma comunidade que compartilha a mesma paixão.</p>
  </div>
  <section class="auth-card">
    <h2>{title}</h2>
    <p>
      {data.mode === 'entrar'
        ? 'Entre para continuar de onde parou.'
        : data.mode === 'cadastrar'
          ? 'Crie sua conta gratuita e encontre seu lugar na Nox.'
          : 'Seu acesso, com segurança.'}
    </p>
    {#if form?.message || data.error}<div
        class:success={form?.success}
        class:error={!form?.success}
        class="notice"
        role="status"
      >
        {form?.message || data.error}
      </div>{/if}
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
    >
      {#if data.mode !== 'redefinir'}<label class="field"
          >E-mail<input
            type="email"
            name="email"
            required
            autocomplete="email"
            maxlength="254"
            placeholder="voce@exemplo.com"
          /></label
        >{/if}
      {#if data.mode !== 'recuperar'}<label class="field"
          >{data.mode === 'redefinir' ? 'Nova senha' : 'Senha'}<input
            type="password"
            name="password"
            required
            minlength="10"
            maxlength="128"
            autocomplete={data.mode === 'entrar' ? 'current-password' : 'new-password'}
            placeholder="Pelo menos 10 caracteres"
          /></label
        >{/if}
      {#if data.mode === 'entrar'}<div style="text-align:right;margin:-6px 0 24px">
          <a class="text-link" href="/recuperar">Esqueci minha senha</a>
        </div>{/if}
      <button class="button" disabled={busy}
        >{busy
          ? 'Aguarde…'
          : data.mode === 'entrar'
            ? 'Entrar na Nox'
            : data.mode === 'cadastrar'
              ? 'Criar minha conta'
              : data.mode === 'recuperar'
                ? 'Enviar link de recuperação'
                : 'Salvar nova senha'}</button
      >
    </form>
    <div class="auth-switch">
      {#if data.mode === 'entrar'}Ainda não tem uma conta? <a href="/cadastrar">Faça parte</a>{:else}<a
          href="/entrar">Voltar para entrar</a
        >{/if}
    </div>
    <p class="small" style="margin-top:25px;margin-bottom:0">
      Seu e-mail nunca aparece no perfil público. <a href="/privacidade">Privacidade</a>
    </p>
  </section>
</div>
