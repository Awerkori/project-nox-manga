<script>
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  let isOffline = $state(false);

  onMount(() => {
    isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const update = () => {
      isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  });
</script>

<div class="container error-page">
  <span class="eyebrow">PROJECT NOX · {page.status}</span>
  <h1>
    {page.status === 404
      ? 'Essa página se perdeu na noite.'
      : page.status === 403
        ? 'Acesso restrito.'
        : isOffline
          ? 'Você está sem conexão com a internet.'
          : 'Uma pausa inesperada.'}
  </h1>
  <p>
    {isOffline
      ? 'Não foi possível carregar esta página da rede. Se você baixou capítulos, eles continuam disponíveis no seu dispositivo.'
      : (page.error?.message || 'Ocorreu um imprevisto ao carregar o conteúdo.')}
  </p>
  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 16px;">
    {#if isOffline}
      <a class="button" href="/downloads" style="background: #7c3aed; color: #fff;">Acessar Downloads Offline</a>
    {/if}
    <a class="button" href="/">Voltar ao início</a>
  </div>
</div>
