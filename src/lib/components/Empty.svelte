<script lang="ts">
  import { BookOpen } from '@lucide/svelte';
  let { title, text, href, label }: { title: string; text: string; href?: string; label?: string } = $props();
</script>

<div class="empty">
  <BookOpen size={32} strokeWidth={1.2} />
  <h2>{title}</h2>
  <p>{text}</p>
  {#if href}<a class="button secondary" {href}>{label}</a>{/if}
</div>
