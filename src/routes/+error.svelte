<script>
  import { page } from '$app/state';
</script>

<div class="container error-page">
  <span class="eyebrow">PROJECT NOX · {page.status}</span>
  <h1>
    {page.status === 404
      ? 'Essa página se perdeu na noite.'
      : page.status === 403
        ? 'Acesso restrito.'
        : 'Uma pausa inesperada.'}
  </h1>
  <p>{page.error?.message}</p>
  <a class="button" href="/">Voltar ao início</a>
</div>
