<script>
  import { BookOpen, Tags, Users, Settings, ArrowUpRight, LayoutDashboard } from '@lucide/svelte';
  let { data, children } = $props();
</script>

<svelte:head><meta name="robots" content="noindex,nofollow" /></svelte:head>
<div class="admin-shell">
  <aside class="admin-sidebar">
    <span class="eyebrow">NOX EDITORIAL</span>
    <p>{data.role === 'ADMIN' ? 'Administração' : 'Publicação e conteúdo'}</p>
    <nav aria-label="Painel editorial">
      <a href="/admin"><LayoutDashboard size={18} /> Visão geral</a><a href="/admin/obras"
        ><BookOpen size={18} /> Obras e capítulos</a
      ><a href="/admin/tags"><Tags size={18} /> Gêneros e tags</a>{#if data.role === 'ADMIN'}<a
          href="/admin/gestao"><Users size={18} /> Usuários e moderação</a
        ><a href="/admin/gestao/configuracoes"><Settings size={18} /> Configurações</a>{/if}<a
        href="/"
        style="margin-top:25px"><ArrowUpRight size={18} /> Ver site público</a
      >
    </nav>
  </aside>
  <div class="admin-content">{@render children()}</div>
</div>

<style>
  .admin-shell {
    display: grid;
    grid-template-columns: 230px 1fr;
    max-width: 1440px;
    margin: auto;
    min-height: 70vh;
  }
  .admin-sidebar {
    border-right: 1px solid var(--line);
    padding: 36px 25px;
  }
  .admin-sidebar > p {
    font-size: 11px;
  }
  .admin-sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 30px;
  }
  .admin-sidebar a {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 12px;
    padding: 13px 10px;
    border-radius: 8px;
    color: #b9afc8;
  }
  .admin-sidebar a:hover {
    background: #241a30;
    color: #d9c3fb;
  }
  .admin-content {
    padding: 34px 36px 70px;
    min-width: 0;
  }
  @media (max-width: 950px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }
    .admin-sidebar {
      padding: 20px;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .admin-sidebar > p {
      display: none;
    }
    .admin-sidebar nav {
      flex-direction: row;
      overflow: auto;
      margin-top: 10px;
      gap: 6px;
    }
    .admin-sidebar a {
      white-space: nowrap;
      margin: 0 !important;
      font-size: 11px;
      padding: 10px;
    }
    .admin-content {
      padding: 26px 20px 45px;
    }
  }
</style>
