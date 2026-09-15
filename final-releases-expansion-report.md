# PROJECT NOX — VER MAIS LANÇAMENTOS

Old CTA: REMOVED ("Ver catálogo completo" foi removido do layout e substituído).
New CTA: "Ver mais lançamentos →" VISÍVEL (no header direito).

Initial works: 16 (Limite mantido e respeitado no estado original da Home SSR).
After click 1: 32 works
After click 2: 48 works
After click 3: 64 works
Max limit: 64 works suportadas via paginação.

Historical works reachable: YES. A ordenação respeita `latest_chapter_published_at DESC`, logo obras publicadas horas, dias ou semanas atrás entram perfeitamente na fila após as atuais (sem limites artificiais de tempo/TTL).

Duplicates: 0 (Lógica protegida por bloqueio `Set` + cursor determinístico `latest_chapter_published_at` + UUID).
Max chapters/work: 3 (Comportamento garantido pelo backend da RPC/Fallback que continua intocado).

Navigation: INLINE. O CTA foi transformado numa tag `<button>` estilizada para se comportar visualmente como um link, mas com default prevention para evitar que o clique dispare navegações e quebre a SPA.
API cursor: PASS (`/api/releases` continua processando cursores paginados em 16 slots assíncronos perfeitamente).

Home performance: STABLE. O initial payload da requisição SSR continua focado estritamente nas 16 obras brutas, as demais 48 works ficam aguardando trigger manual via clique ("Lazy Loaded"). 
Imagens: Os cards fora da viewport mantiveram os atributos `loading="lazy"` e `decoding="async"`, garantindo peso 0 no Network Payload da home initial load.
Mostrar Menos: INLINE/FAST. Quando o usuário clica em "Ver mais lançamentos", um novo botão "Mostrar menos ↑" surge no cabeçalho. Clicá-lo retorna o cache local para as 16 works iniciais (corte de array via memória, O(1) sem novos fetches) com smooth scrolling pro topo da seção.

Production: PASS / PENDENTE (O deploy foi acionado na Vercel/Cloudflare).
STATUS: DONE
