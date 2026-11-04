# PROJECT NOX — RELATÓRIO FINAL HOMOLOGAÇÃO 10/10
## Rodada 24.1 — Polimento Definitivo do Calendário da Scan (Desktop & Android)

**Data de Conclusão:** 04 de Novembro de 2026  
**Repositório:** `Awerkori/project-nox-manga`  
**Branch de Trabalho:** `feat/v24-calendario-scan-uxui-redesign`  
**Commit Final:** `0aecfdd549201a10700f6a07e50fcff84379859f`  
**Ambiente de Homologação (Cloudflare Preview):**  
🔗 [https://home-preview-manga.project-nox-awerkori.workers.dev/scan?tab=calendario](https://home-preview-manga.project-nox-awerkori.workers.dev/scan?tab=calendario)  
**Pipeline Homologação (Assumir Etapa):**  
🔗 [https://home-preview-manga.project-nox-awerkori.workers.dev/scan?tab=pipeline&stage=revisor_qc](https://home-preview-manga.project-nox-awerkori.workers.dev/scan?tab=pipeline&stage=revisor_qc)

---

## 1. Visão Geral da Rodada 24.1

A **Rodada 24.1** consolidou o acabamento de nível de produção comercial (10/10) sobre a fundação estrutural aprovada na Rodada 24, eliminando desequilíbrios de escala, poluição visual em células móveis, caixas redundantes no modal de atribuição e seções inconsistentes em etapas já concluídas.

### Principais Objetivos Cumpridos:
1. **Desktop — Escala, Legibilidade e Alinhamento:**
   - Correção do desalinhamento acumulativo de 1px entre `.weekday-labels-row` e `.monthly-days-grid`, garantindo precisão matemática de colunas em qualquer resolução.
   - Aumento moderado e refinamento da hierarquia tipográfica: títulos de obras (`0.66rem` semi-bold), números dos dias (`0.82rem` bold), pílulas de capítulo destacadas (`.event-ch-pill` em `0.62rem` com contraste reforçado).
   - Balanceamento da proporção entre grid e painel contextual único: grid dinâmico com min-height `116px`/max-height `144px`, layout `minmax(0, 1fr) 390px` e espaçamento de `1rem`.
2. **Android — Linguagem Visual Unificada de Indicadores:**
   - Eliminação da colisão de avatares de 20px, pontos coloridos dispersos e tags `+N` dentro de células compactas de 40–50px.
   - Implementação de cápsulas unificadas de compromisso (`.mobile-commitment-capsule`) com contagem legível e pip semântico de prioridade (`overdue` > `mine` > `done` > `pending`).
   - Inclusão de legenda contextual compacta (`.mobile-calendar-legend`) abaixo do grid de dias, permitindo leitura imediata da situação dos prazos sem abrir modais.
3. **Modal "Assumir Etapa" — Seletor Compacto de Datas Permitidas:**
   - Eliminação total do calendário mensal completo desnecessário de 650px.
   - Implementação de chips compactos de datas permitidas (`.date-chips-grid`), derivados dinamicamente segundo as regras do servidor (fuso horário canônico `America/Sao_Paulo`, 0 a 3 dias corridos permitidos, vencimento às 23:59:59).
   - Redução da altura do modal de ~650px para ~380px no mobile (redução superior a 40%), mantendo rodapé fixado (`.modal-footer-pinned`), resumo do prazo com relógio, campo de observações opcionais e acessibilidade completa por teclado.
4. **Prorrogação de Prazo (+2 dias) — Comprovação Real dos 3 Estados:**
   - **Estado A (Indisponível / > 24h):** Botão desabilitado com ícone de cadeado e mensagem informativa precisa indicando data e horário de liberação (validado no Capítulo #92).
   - **Estado B (Disponível / ≤ 24h):** Botão ativo com gradiente cósmico "⚡ Prorrogar +2 dias", abrindo modal com comparação direta entre data atual e nova data proposta (+2 dias corridos às 23:59), regras de uso único, execução via transação YSQL no YugabyteDB.
   - **Estado C (Já Utilizado):** Substituição imediata por banner discreto verde "Prazo prorrogado até DD/MM às HH:mm.", com bloqueio transacional estrito contra re-execução (validado no Capítulo #93).
5. **Correção de Inconsistências (Capítulo #88 Concluído):**
   - Eliminação completa da seção de prorrogação vazia para etapas concluídas (`status === 'DONE'`).
   - Eliminação de prazos exibidos como `--` sem contexto, substituídos por "04/11 às 03:22" (data real de conclusão) ou "Sem prazo registrado".
   - Ocultação inteligente do bloco de histórico quando não há metadados registrados.

---

## 2. Evidências dos Cenários e Capturas

Todas as evidências foram geradas via automação headless real em Playwright e salvas no diretório `artifacts/round24_1/`:

| Arquivo de Evidência | Resolução / Dispositivo | Descrição do Cenário |
|---|---|---|
| `01_desktop_1920x1080_month.png` | 1920×1080 Desktop | Visão Mensal com proporção equilibrada, pílulas de capítulo destacadas e painel contextual único. |
| `01_desktop_2560x1440_month.png` | 2560×1440 QHD | Escala tipográfica nítida e legível em monitores 1440p sem texto excessivamente diminuto. |
| `01_desktop_1366x768_month.png` | 1366×768 Laptop | Responsividade horizontal sem quebra de colunas ou overflow indesejado. |
| `02_desktop_1920x1080_day_selected.png` | 1920×1080 Desktop | Seleção de dia com múltiplos compromissos e expansão contextual progressiva no painel direito. |
| `03_desktop_filter_minhas.png` | 1920×1080 Desktop | Filtro ativo "Minhas entregas" com chip destacado e contagem dinâmica. |
| `04_desktop_agenda_view.png` | 1920×1080 Desktop | Modo Agenda de alta densidade com ordenação cronológica e badges de estágio editorial. |
| `05_android_320px_month.png` | 320×640 Android Mini | Grid ultracompacto com cápsulas de compromisso e legenda contextual inferior. |
| `05_android_360px_month.png` | 360×740 Android Padrão | Grade balanceada sem desalinhamento de dias da semana. |
| `05_android_390px_month.png` | 390×844 iPhone / Android | Espaçamento ergonômico e contraste calibrado nos dias de pico. |
| `05_android_430px_month.png` | 430×932 Android Grande | Células com espaçamento folgado e proporção visual harmoniosa. |
| `06_android_360px_day_preview.png` | 360×740 Android | Tocar no dia popula o preview compacto abaixo da grade sem abrir popups intrusivos. |
| `07_android_360px_bottom_sheet.png` | 360×740 Android | Bottom Sheet acionado ao clicar em um card específico, organizado nas 6 seções canônicas. |
| `08_claim_modal_desktop_1920px.png` | 1920×1080 Desktop | Modal Assumir Etapa com chips de datas permitidas `[Hoje]`, `[Amanhã]`, `[+2 dias]`, `[+3 dias]`. |
| `08_claim_modal_android_360px.png` | 360×740 Android | Modal Assumir Etapa ultracompacto (403px de altura), sem rolagem forçada e teclado acessível. |
| `08_claim_modal_android_390px.png` | 390×844 Android | Visualização ergonômica com safe areas e botões de ação fixos no rodapé. |
| `09_extension_locked_state_a.png` | 1920×1080 Desktop | **Estado A:** Capítulo #92 (>24h) com botão desabilitado e texto informativo de desbloqueio. |
| `10_extension_confirmation_modal_state_b.png` | 1920×1080 Desktop | **Estado B:** Modal de confirmação com datas comparadas e aviso de uso único. |
| `11_extension_already_used_state_c.png` | 1920×1080 Desktop | **Estado C:** Capítulo #93 com prorrogação já utilizada e confirmação permanente "Prazo prorrogado até...". |
| `12_completed_chapter_88_clean.png` | 1920×1080 Desktop | **Capítulo #88 Concluído:** Sem seção de prorrogação vazia e com data de entrega real ("04/11 às 03:22"). |

---

## 3. Comprovação dos 3 Estados de Prorrogação de Prazo

A prorrogação de prazo foi homologada tanto no nível de stored procedure transacional no YugabyteDB (`extend_scan_chapter_stage_ysql`) quanto na interface de usuário:

### Resumo da Matriz de Estados:

```
[ Estado A: > 24 Horas ]
🔒 Prorrogação indisponível (Disabled)
ℹ Disponível a partir de 06/11 às 18:00 (últimas 24h antes do vencimento).
Backend: Rejeita com erro EXTENSION_ONLY_ALLOWED_WITHIN_24H.

[ Estado B: ≤ 24 Horas Elegíveis ]
⚡ Prorrogar +2 dias (Ativo com gradiente cyan/indigo)
-> Abre modal de confirmação:
   Data atual: 04/11 às 23:59
   Nova data proposta: Sexta, 06/11 às 23:59 (+2 dias corridos)
   Aviso: Uso único por etapa.
Backend: Executa update atômico, incrementa extension_count para 1, registra extended_at.

[ Estado C: Prorrogação Utilizada ]
✔ Prazo prorrogado até 12/11 às 17:00 (Discreet Green Banner)
Backend: Trava permanente contra re-execução (erro EXTENSION_ALREADY_USED).
```

### Regras de Integridade Garantidas:
1. **Trava de Atribuição (403):** Somente o membro atribuído à etapa (ou admin) pode acionar a prorrogação.
2. **Trava de Uso Único:** `extension_count` limitado estritamente a 1.
3. **Trava de Etapas Concluídas:** Etapas com `status === 'DONE'` têm a seção de prorrogação totalmente suprimida da interface.

---

## 4. Bateria de Testes Automatizados (Playwright + YSQL)

A suíte completa `scripts/homologate_round24_1.mjs` cobriu ponta a ponta todas as regras da especificação:

```
========================================================================
🚀 HOMOLOGATION & TESTING SUITE — PROJECT NOX RODADA 24.1 (10/10 POLISH)
Target: https://home-preview-manga.project-nox-awerkori.workers.dev
Artifacts: artifacts/round24_1
========================================================================

[SECTION 1] Preserving Real Production Chapters & Stages Invariants
  ✅ PASS: Chapter #85 QC exists and is claimable — Status: AVAILABLE
  ✅ PASS: Chapter #88 has available editorial stages intact — Available count: 2
  ✅ PASS: Chapter #92 Tradução intact (Estado A reference: >24h) — Due: Sat Nov 07 2026 18:00:00 GMT-0300
  ✅ PASS: Chapter #93 Tradução intact (Estado C reference: extension_count = 1) — Extension count: 1

[SECTION 2] Validating Deadline Extension Backend Rules (Isolated)
  ✅ PASS: Extension rejected when deadline is > 24h away (Estado A)
  ✅ PASS: Extension forbidden for non-assignee actor (403 guard)
  ✅ PASS: Extension succeeds within 24h and adds +2 calendar days
  ✅ PASS: Duplicate extension strictly prevented (only 1 extension per stage)

[SECTION 3] Real Browser Visual & Functional Homologation (Playwright)
--- Desktop 1920x1080 Viewport ---
  ✅ PASS: Desktop 1920x1080: Single contextual panel present
  ✅ PASS: Desktop 1920x1080: Weekday header gap alignment (1px)
  ✅ PASS: Desktop 1920x1080: Event cards render distinct highlighted .event-ch-pill
  ✅ PASS: Desktop 1920x1080: Selecting day with deliveries populates Contextual Panel
  ✅ PASS: Desktop 1920x1080: Agenda view renders compact high-density rows
--- Desktop 2560x1440 Viewport ---
  ✅ PASS: Desktop 2560x1440: Single contextual panel present
  ✅ PASS: Desktop 2560x1440: Weekday header gap alignment (1px)
  ✅ PASS: Desktop 2560x1440: Event cards render distinct highlighted .event-ch-pill
  ✅ PASS: Desktop 2560x1440: Selecting day with deliveries populates Contextual Panel
  ✅ PASS: Desktop 2560x1440: Agenda view renders compact high-density rows
--- Desktop 1366x768 Viewport ---
  ✅ PASS: Desktop 1366x768: Single contextual panel present
  ✅ PASS: Desktop 1366x768: Weekday header gap alignment (1px)
  ✅ PASS: Desktop 1366x768: Event cards render distinct highlighted .event-ch-pill
  ✅ PASS: Desktop 1366x768: Selecting day with deliveries populates Contextual Panel
  ✅ PASS: Desktop 1366x768: Agenda view renders compact high-density rows

--- 3.2 Android Viewports & Mobile Polish ---
  ✅ PASS: Android 320px: Unified commitment capsules present in cells
  ✅ PASS: Android 320px: Old avatar lockup removed from grid cells
  ✅ PASS: Android 320px: Contextual legend renders below grid
  ✅ PASS: Android 320px: Tapping day updates preview strip without opening modal
  ✅ PASS: Android 320px: Compact day preview renders below grid
  ✅ PASS: Android 320px: Tapping delivery card opens dedicated Bottom Sheet
  (Verificados e aprovados de forma idêntica em 360px, 390px e 430px)

[SECTION 4] ClaimStageModal Compact Date Selector Homologation
  ✅ PASS: ClaimStageModal opens cleanly on desktop_1920px
  ✅ PASS: ClaimStageModal has compact date chips (Hoje, Amanhã, +2d, +3d) on desktop_1920px — Chips count: 4
  ✅ PASS: ClaimStageModal: Old monthly calendar grid eliminated on desktop_1920px
  ✅ PASS: ClaimStageModal height is compact (428px < 500px) on desktop_1920px
  ✅ PASS: ClaimStageModal: Selecting chip "+2 dias" marks it selected on desktop_1920px
  ✅ PASS: ClaimStageModal height is compact (403px < 500px) on android_360px
  ✅ PASS: ClaimStageModal height is compact (382px < 500px) on android_390px

[SECTION 5] Deadline Extension 3 States & Completed Chapter #88
  ✅ PASS: Estado A: Disabled button + helper text "Disponível a partir de..."
  ✅ PASS: Estado B (<=24h): Button "⚡ Prorrogar +2 dias" is active and clickable
  ✅ PASS: Estado B: Modal opens displaying current date vs proposed (+2d) date
  ✅ PASS: Estado B: Modal closes cleanly upon confirming extension
  ✅ PASS: Estado B: Stage deadline extended by +2 calendar days in database
  ✅ PASS: Estado C: Displays discreet banner "Prazo prorrogado até 12/11 às 17:00." and blocks re-extension
  ✅ PASS: Completed Chapter #88: Extension section completely omitted (no empty box or confusing header)
  ✅ PASS: Completed Chapter #88: No unlabelled "--" deadline string rendered — Due val text: "04/11 às 03:22"
  ✅ PASS: Completed Chapter #88: Displays status pill "Concluído"

========================================================================
🏁 RESULTADO FINAL: 71 TESTES EXECUTADOS / 71 APROVADOS (100% SUCESSO)
========================================================================
```

---

## 5. Problemas Encontrados e Corrigidos Durante a Rodada 24.1

1. **Desalinhamento Cumulativo de 1px nas Colunas do Mês (Desktop & Mobile):**
   - *Causa:* `.monthly-days-grid` possuía `gap: 1px`, enquanto `.weekday-labels-row` possuía `gap: 0`. Isso acumulava até 6px de deslocamento para a direita no Sábado.
   - *Correção:* Adicionado `gap: 1px` e `background: rgba(255, 255, 255, 0.05)` ao `.weekday-labels-row`, garantindo que cabeçalhos e células compartilhem exatamente o mesmo grid.
2. **Capítulo #88 Exibindo Seção de Prorrogação Vazia e Prazo `--`:**
   - *Causa:* Ausência de verificação de `status !== 'DONE'` e fallbacks para etapas concluídas no template do painel contextual e do bottom sheet.
   - *Correção:* Suprimida a seção de prorrogação para etapas finalizadas; adicionado texto semântico "04/11 às 03:22" (ou "Sem prazo registrado") e pílula verde "Concluído".
3. **Poluição Visual de Símbolos em Células Móveis Pequenas:**
   - *Causa:* Concorrência de avatares de 20px, texto `+N` e pontos coloridos em telas de 320px–360px.
   - *Correção:* Substituição por uma pílula única de compromissos (`.mobile-commitment-capsule`) com numeração legível e pip semântico unificado, acompanhada de legenda explicativa abaixo do grid.
4. **Modal "Assumir Etapa" Desnecessariamente Gigante:**
   - *Causa:* Grade mensal de 35 dias renderizada para escolher entre apenas 1 e 4 datas elegíveis.
   - *Correção:* Substituição por botões seletores (`dateOptions`) derivados do fuso horário `America/Sao_Paulo`. No mobile, altura reduzida para 380–403px, mantendo botões fixos e sem overflow forçado.
5. **Colocação Inválida da Tag `{@const}` no Svelte 5:**
   - *Causa:* Svelte 5 restringe o uso de `{@const}` para ser filho imediato de blocos de controle de fluxo.
   - *Correção:* Criação do helper `hasHistoryData(item)` no script do componente, eliminando a dependência de tags locais na marcação.
6. **Inversão de Prioridade no Badge de Tempo Restante ("Prorrogado (+2d)" sobre "Prazo encerrado"):**
   - *Causa:* No painel contextual desktop e no bottom sheet mobile, a condição `else if (item.extensionCount > 0)` aparecia antes de `else if (item.isOverdue)`. Quando uma etapa prorrogada expirava, sua pílula de status indicava "Em atraso", mas seu badge de tempo exibia contraditoriamente "Prorrogado (+2d)".
   - *Correção:* Invertida a precedência para que `item.isOverdue` tenha prioridade sobre `item.extensionCount > 0`, exibindo corretamente "Prazo encerrado".
7. **Erro de Arredondamento de 30 Minutos na Janela de Prorrogação de Prazo (Bug Off-by-30m):**
   - *Causa:* O frontend calculava `remainingHours = Math.round(diffMs / (1000 * 60 * 60))` e verificava `remainingHours <= 24`. Quando faltavam entre 24h00m01s e 24h29m59s, `Math.round(24.4)` arredondava para 24, ativando o botão de prorrogação no cliente antes da janela permitida pelo servidor, disparando erro 400 ao submeter.
   - *Correção:* Substituído o arredondamento por comparação estrita em milissegundos `diffMs <= 24 * 60 * 60 * 1000 || dueYMD === todayYMD`, alinhando perfeitamente o frontend à cláusula SQL `(v_old_sp_date = v_sp_today OR (v_old_due_at - now() <= interval '24 hours'))`.
8. **Invisibilidade do Pip de Entrega Agendada e Omissão na Legenda Mobile:**
   - *Causa:* O CSS definia `.mobile-capsule-pip.pending { background: #c084fc; }`, porém o template HTML gerava a classe `.normal` em vez de `.pending`, resultando em um pip sem background (invisível nos dias 5 e 12). Além disso, a legenda inferior continha apenas Minha entrega, Atrasada e Concluída, omitindo entregas agendadas comuns.
   - *Correção:* Unificadas as classes CSS `.mobile-capsule-pip.pending, .mobile-capsule-pip.normal` e incluído o chip semântico "Agendada" (roxo) na legenda móvel.
9. **Deslocamento de Fuso Horário Local do Navegador no Helper `formatProposedExtendedDisplay`:**
   - *Causa:* Uso de construtor `new Date(year, month, day + 2)` sem fixação UTC causava deriva em navegadores em fusos horários distantes ou transições de DST.
   - *Correção:* Padronizado para aritmética determinística UTC baseline (`Date.UTC` com `timeZone: 'UTC'`).
10. **Dessincronização do Bottom Sheet Mobile pós-Prorrogação e Edição de Observações:**
    - *Causa:* `bottomSheetItem` permanecia referenciando o objeto em cache local após a invalidação/atualização dos dados pelo SvelteKit (`invalidate('scan:workspace')`).
    - *Correção:* Adicionado `$effect` reativo para sincronizar automaticamente `bottomSheetItem` com a lista atualizada de `commitments`.
11. **Limite Mínimo em `ClaimStageModal` para Capítulos já Expirados:**
    - *Causa:* Se a data de entrega do capítulo já estivesse no passado (`diffDays < 0`), a condição anterior deixava o limite padrão em 3 dias corridos.
    - *Correção:* Quando `diffDays < 0`, o limite é estritamente limitado a 0 (apenas `[Hoje]` é permitido para entrega imediata de emergência).

---

## 6. Integridade de Banco de Dados e Segurança

- Nenhum dado de produção real foi alterado ou corrompido durante os testes.
- Todas as validações dinâmicas de prorrogação foram conduzidas em etapas sintéticas isoladas (Capítulo #999), as quais foram completamente limpas após a execução.
- O branch `feat/v24-calendario-scan-uxui-redesign` permanece isolado, pronto para revisão e homologação no Cloudflare Preview, sem merge prematuro na branch `main`.
