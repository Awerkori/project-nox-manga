<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { ArrowLeft, ArrowRight, Settings2, Maximize, ChevronUp } from '@lucide/svelte';
  import ReaderPage from '$lib/components/ReaderPage.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import { action } from '$lib/actions';
  import { readPreference, savePreference } from '$lib/preferences';
  let { data } = $props();
  let current = $state(1),
    settings = $state(false),
    width = $state(850),
    gap = $state(false),
    notice = $state(''),
    fullscreen = $state(false);
  const visible = new SvelteSet<number>();
  let sending = false;
  function seen(page: number, isVisible: boolean) {
    if (isVisible) visible.add(page);
    else visible.delete(page);
    if (visible.size) current = Math.min(...visible);
  }
  function jump(page: number) {
    document.getElementById(`pagina-${page}`)?.scrollIntoView({ behavior: 'instant' });
  }
  async function full() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notice = 'Tela cheia indisponível neste navegador.';
    }
  }
  onMount(() => {
    fullscreen = !!document.documentElement.requestFullscreen;
    try {
      const prefs = JSON.parse(readPreference('nox-reader') || '{}');
      width = Math.min(1200, Math.max(400, Number(prefs.width) || 850));
      gap = !!prefs.gap;
    } catch {
      /* Default preferences remain valid. */
    }
    const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
    requestAnimationFrame(() => jump(Math.min(data.pages.length, Math.max(1, saved))));
    if (data.profile && !data.preview)
      action('member', 'read_start', { work_id: data.chapter.work_id, chapter_id: data.chapter.id }).catch(
        () => {
          notice = 'Sincronização indisponível. Tentaremos novamente durante a leitura.';
        }
      );
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || sending || !visible.size) return;
      const locallySaved = savePreference(`nox-page:${data.chapter.id}`, String(current));
      savePreference('nox-reader', JSON.stringify({ width, gap }));
      if (data.profile && !data.preview) {
        sending = true;
        try {
          await action('member', 'read_page', {
            work_id: data.chapter.work_id,
            chapter_id: data.chapter.id,
            page: current
          });
          notice = '';
        } catch {
          notice = locallySaved
            ? 'Sem conexão para sincronizar. O progresso está salvo neste dispositivo.'
            : 'Não foi possível salvar o progresso. Verifique sua conexão.';
        } finally {
          sending = false;
        }
      }
    }, 3500);
    const saveOnExit = () => {
      if (!visible.size) return;
      savePreference(`nox-page:${data.chapter.id}`, String(current));
      savePreference('nox-reader', JSON.stringify({ width, gap }));
      if (data.profile && !data.preview)
        void fetch('/api/action', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'member',
            action: 'read_page',
            data: { work_id: data.chapter.work_id, chapter_id: data.chapter.id, page: current }
          })
        }).catch(() => {});
    };
    window.addEventListener('pagehide', saveOnExit);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', saveOnExit);
      saveOnExit();
    };
  });
</script>

<svelte:head
  ><title>{data.chapter.works?.title} — Capítulo {data.chapter.number} | Project Nox</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="reader-shell">
  <header class="reader-bar">
    <a
      href={data.preview ? `/admin/obras/${data.chapter.work_id}` : `/obra/${data.chapter.works?.slug}`}
      aria-label="Voltar para obra"><ArrowLeft size={20} /></a
    >
    <div>
      <strong>{data.chapter.works?.title}</strong><span
        >Capítulo {data.chapter.number}{data.preview ? ' · Prévia editorial' : ''}</span
      >
    </div>
    <div class="reader-tools">
      <span>{current}/{data.pages.length}</span><button
        class="icon-button"
        aria-label="Ajustes de leitura"
        onclick={() => (settings = !settings)}><Settings2 size={20} /></button
      >{#if fullscreen}<button class="icon-button" aria-label="Alternar tela cheia" onclick={full}
          ><Maximize size={19} /></button
        >{/if}
    </div>
  </header>
  {#if settings}<aside class="reader-settings">
      <label class="field"
        >Largura de leitura<input type="range" min="400" max="1200" step="50" bind:value={width} /></label
      ><label class="small"><input type="checkbox" bind:checked={gap} /> Separar páginas tradicionais</label
      ><label class="field" style="margin-top:20px"
        >Ir para página<select value={current} onchange={(e) => jump(Number(e.currentTarget.value))}
          >{#each data.pages as page (page.position)}<option value={page.position}>{page.position}</option
            >{/each}</select
        ></label
      ><button class="button secondary compact" onclick={() => (settings = false)}>Fechar ajustes</button>
    </aside>{/if}
  {#if notice}<div class="notice reading-width" role="status">{notice}</div>{/if}
  <div class="page-stack" style="max-width:{width}px;gap:{gap ? '20px' : '0'}">
    {#each data.pages as page (page.position)}<ReaderPage {page} onSeen={seen} />{/each}
  </div>
  <div class="reader-end">
    <span class="eyebrow">ATÉ A PRÓXIMA PÁGINA</span>
    <h2>Fim do capítulo {data.chapter.number}.</h2>
    <div class="row">
      {#if data.previous}<a class="button secondary" href="/ler/{data.previous.id}"
          ><ArrowLeft size={17} /> Anterior</a
        >{/if}{#if data.next}<a class="button" href="/ler/{data.next.id}"
          >Próximo capítulo <ArrowRight size={17} /></a
        >{:else}<a class="button" href="/obra/{data.chapter.works?.slug}">Voltar para a obra</a>{/if}
    </div>
    <p class="small muted">Edição Project Nox · Obrigado por ler com a gente.</p>
  </div>
  <div class="reader-comments">
    {#if !data.preview}<Comments
        comments={data.comments}
        workId={data.chapter.work_id}
        chapterId={data.chapter.id}
        profile={data.profile}
      />{/if}
  </div>
  <button class="back-top icon-button" aria-label="Voltar ao topo" onclick={() => jump(1)}
    ><ChevronUp /></button
  >
  <div class="reader-progress" style="width:{(current / Math.max(1, data.pages.length)) * 100}%"></div>
</div>

<style>
  .reader-shell {
    background: #070708;
    min-height: 100vh;
  }
  .reader-bar {
    height: 66px;
    position: sticky;
    top: 0;
    z-index: 20;
    background: #111016ee;
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #27232d;
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 0 25px;
  }
  .reader-bar > div:nth-child(2) {
    min-width: 0;
  }
  .reader-bar strong {
    display: block;
    max-width: 45vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  .reader-bar span {
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 4px;
  }
  .reader-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  .reader-tools > span {
    font-size: 11px;
    margin: 0;
  }
  .page-stack {
    margin: auto;
    display: flex;
    flex-direction: column;
  }
  .reader-settings {
    position: fixed;
    top: 76px;
    right: 15px;
    z-index: 30;
    width: 280px;
    background: #1c1625;
    border: 1px solid #44324f;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 15px 50px #000a;
  }
  .reader-end {
    padding: 65px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .reader-end h2 {
    font-size: 26px;
  }
  .reader-comments {
    max-width: 850px;
    margin: auto;
    padding: 0 22px 30px;
  }
  .reader-progress {
    height: 2px;
    position: fixed;
    bottom: 0;
    left: 0;
    background: var(--purple);
    z-index: 50;
  }
  .back-top {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #211828c9;
    border: 1px solid #493852;
  }
  .reader-bar > a {
    padding: 8px;
  }
  .reader-bar .icon-button {
    padding: 8px;
  }
  @media (max-width: 600px) {
    .reader-bar {
      padding: 0 8px;
      gap: 6px;
      height: 60px;
    }
    .reader-tools {
      gap: 0;
    }
    .reader-bar strong {
      max-width: 43vw;
      font-size: 11px;
    }
    .reader-bar span {
      font-size: 9px;
    }
    .reader-end h2 {
      font-size: 22px;
    }
  }
</style>
