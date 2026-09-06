<script lang="ts">
  import { action } from '$lib/actions';
  let { data } = $props();
  let notice = $state('');
  async function save(event: SubmitEvent) {
    event.preventDefault();
    const f = new FormData(event.currentTarget as HTMLFormElement);
    try {
      await action('owner', 'setting', { key: f.get('key'), value: f.get('value') });
      notice = 'Configuração salva.';
    } catch (e) {
      notice = (e as Error).message;
    }
  }
</script>

<svelte:head><title>Configurações — Nox Admin</title></svelte:head><span class="eyebrow">ADMINISTRAÇÃO</span>
<h1 style="font-size:34px">Configurações</h1>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}
<div class="two-columns">
  <section class="panel">
    <h2 style="font-size:22px">Informações do site</h2>
    {#each data.settings as setting (setting.key)}<form onsubmit={save} style="margin-bottom:25px">
        <input type="hidden" name="key" value={setting.key} /><label class="field"
          >{setting.key === 'site_name'
            ? 'Nome do site'
            : setting.key === 'description'
              ? 'Descrição'
              : 'E-mail de contato'}<input name="value" value={setting.value} maxlength="2000" /></label
        ><button class="button secondary compact">Salvar</button>
      </form>{/each}
  </section>
  <section class="panel">
    <h2 style="font-size:22px">Integrações</h2>
    <div class="stack">
      <div>
        <h3>Banco e autenticação</h3>
        <span class="chip">Supabase conectado</span>
      </div>
      <div>
        <h3>Armazenamento de páginas</h3>
        <span class="chip">{data.telegram ? 'Telegram configurado' : 'Supabase Storage'}</span>
        <p class="small">
          Uploads interrompem ao atingir a reserva gratuita. Nenhuma cobrança é ativada automaticamente.
        </p>
      </div>
      <div>
        <h3>Central da staff</h3>
        <span class="chip">{data.staff ? 'Conectada' : 'Conexão pendente'}</span>
        <p class="small">Somente arquivos de capítulos aprovados pela revisão podem ser importados.</p>
      </div>
    </div>
  </section>
</div>
