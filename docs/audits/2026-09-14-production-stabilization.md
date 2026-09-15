# Auditoria de produção — em andamento

Não homologado. Snapshot de progresso em 2026-09-14 17:20 UTC.

## Evidências confirmadas

- Baseline HTTP: 500 requests, 489 HTTP 200, 10 HTTP 503, 1 timeout. Os 503 de obra foram correlacionados a timeouts Supabase no Worker, não a erro genérico Cloudflare.
- Importer antigo: RSS médio 386,5 MB; p95 480 MB; pico 491 MB. Dashboard DIScloud confirmou falta de RAM e app parado no commit 6e64aa4. max_connections=60; pressão observada era principalmente consultas e concorrência, não 60 conexões permanentemente ocupadas.
- Semáforo antigo duplicava permissões ao aumentar e não reduzia corretamente. Engine sobrescrevia os limites conservadores; buffers somados duas vezes na avaliação de memória.
- One Piece 51: 5 páginas armazenadas, das quais quatro eram miniaturas 75×106 de recomendações. Fonte contém manifesto de 21 páginas. Parser corrigido e testado. Reparação real enfileirada; ainda não homologada no Reader.
- Firefox visível normal/private: One Piece mostrou 62 links únicos em ambos e capa renderizada 683×1000. Sessão normal autenticada. Isso não prova paridade de todas as obras.
- Soak Firefox 30 min: 90 ciclos, 87 verificações Back, 86 correspondências; cinco erros de módulos JS, um 404 inesperado. Teste não aprovado. Arquivos antigos removidos após deploy foram uma causa confirmada (URL antiga retornava 404 com cache immutable de um ano).
- Painel antes: mediana 4381 ms, máximo 6138 ms em cinco amostras. Depois de RLS: mediana 504 ms, máximo 832 ms, sem importer ativo. Sob importer, houve 503 na RPC de contagens; cookies antigos repetidos pelo sampler causavam renovação a cada cliente. Firefox e sampler foram ajustados para distinguir isso; não declarar zero erros geral.

## Correções aplicadas

Web: verificação real de sessão; media pública sem consultas de sessão e streaming; conteúdo público sem drafts implícitos; Reader com primeiras páginas antecipadas e prefetch limitado; RLS avalia identidade uma vez; contagens agregadas no banco sem truncamento PostgREST; painel não inventa zeros ou saúde; polling sem sobreposição; versões anteriores de assets preservadas e erros de assets sem cache prolongado.

Banco: índice parcial de descoberta; admissão atômica limitada; integridade de publicação (páginas presentes, contínuas, distintas, media pronta, bytes/MIME/dimensões válidos); substituição transacional de páginas com remoção das sobras; recovery gap preservada em CLOSED/RECOVERING.

Importer: permissões corrigidas, buffers limitados desde download até upload, tamanho máximo de imagem, parser Madara completo, deadlock source/global removido, descoberta separada de slots de capítulo, pool compartilhado limitado e erros de fontes isolados da pressão global.

## Estado e limites

- Web implantado: d8f62cf4-3717-4390-8243-7e2d51db5e7c.
- DIScloud autorizado pelo usuário e acessível. Repositório privado Awerkori/project-nox-importer verificado como pertencente à conta autenticada com permissão admin/push.
- Importer retomou; commits sucessivos corrigem causas identificadas. Reinícios de deploy devem ser separados de crashes/OOM nas métricas.
- Última suíte: 173 testes do Importer; web 12 testes direcionados. Build de ambos passou. svelte-check global tem milhares de erros preexistentes; não aprovado.
- Sem max safe throughput confirmado. Nenhum nível passou ainda a sequência completa de 10 minutos + soak 30–60 min com conteúdo íntegro.
- Falta: concluir reparos, testar 20 capítulos novos naturais, Fresh/Recovery/Historical e fairness reais, governança de pressão web, coberturas/fontes restantes, repetir soak e obter curva de capacidade.

Evidências locais: /tmp/nox-supreme-audit. Arquivos com cookies/headers não devem ser publicados nem incluídos no Git.
