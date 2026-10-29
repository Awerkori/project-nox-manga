# Project Nox · Plataforma Web de Mangá

Plataforma web oficial e leitor online do **Project Nox**, desenvolvida com **SvelteKit**, renderização no Edge via **Cloudflare Workers** e persistência de dados e autenticação via **Supabase**.

---

🌐 **Acesse online em produção:** [manga.project-nox-awerkori.workers.dev](https://manga.project-nox-awerkori.workers.dev)  
*(Espelho alternativo: [project-nox-manga.project-nox-awerkori.workers.dev](https://project-nox-manga.project-nox-awerkori.workers.dev))*

---

## 🎯 Para quem é este repositório?

- **Leitores:** Para quem prefere ler mangás, manhwas e quadrinhos diretamente no navegador web em qualquer dispositivo (desktop, celular, tablet), sem precisar instalar aplicativos Android.
- **Desenvolvedores:** Para quem deseja explorar ou colaborar em uma aplicação full-stack moderna com Server-Side Rendering (SSR) no Edge, arquitetura orientada a serviços leves e interface responsiva de alta performance.

> [!NOTE]
> Se você procura as **extensões para leitores móveis como Mihon e forks**, consulte:  
> ➡️ [**Project Nox · Extensões de Mangá (Distribuição)**](https://github.com/Awerkori/manga-extensoes)  
> ➡️ [**Project Nox · Código-fonte das Extensões de Mangá**](https://github.com/Awerkori/manga-fonte-extensoes)

---

## ✨ Recursos da Plataforma

- **Leitor Otimizado:** Modos de leitura contínua (cascata vertical) e página por página com pré-carregamento dinâmico de alta velocidade e suporte a atalhos de teclado.
- **Catálogo Integrado e Resiliente:** Ingestão contínua e atualização automática do catálogo através do serviço autônomo [`project-nox-importer`](https://github.com/Awerkori/project-nox-importer).
- **Área de Usuário e Gamificação:** Autenticação via Supabase Auth, sincronização de progresso e histórico de leitura na nuvem, conquistas, molduras colecionáveis e personalização visual de perfil.
- **Arquitetura Serverless Resiliente:** Execução no Cloudflare Workers com uso inteligente de cotas gratuitas e proteção contra custos inesperados.

---

## 🛠️ Tecnologias Utilizadas

- **Framework:** SvelteKit (SSR com adapter Cloudflare Workers)
- **Estilização:** Tailwind CSS com paleta visual roxa e dourada do Project Nox
- **Edge Runtime:** Cloudflare Workers
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL + Supabase Auth)
- **Testes & Qualidade:** Vitest, Playwright e suíte de testes de integridade transacional

---

## 💻 Como Executar Localmente

### Pré-requisitos
- **Node.js** 22 ou posterior
- Gerenciador de pacotes `npm`

### Instalação
```bash
# Instalar dependências
npm ci

# Configurar variáveis de ambiente
cp .env.example .env
# Preencha as credenciais locais conforme necessário

# Iniciar servidor de desenvolvimento
npm run dev
```

### Validações e Testes
```bash
npm run lint          # Verificação de formatação e linter
npm run check         # Checagem de tipos Svelte/TypeScript
npm test              # Testes unitários
npm run build         # Build de produção para Cloudflare Workers
```

> [!IMPORTANT]
> `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` são chaves públicas do cliente. A `SUPABASE_SERVICE_ROLE_KEY` pertence exclusivamente ao banco administrativo do backend e **nunca** deve ser versionada no repositório nem exposta publicamente.

---

## 🔗 Ecossistema Project Nox

- 📦 [**Project Nox · Extensões de Mangá**](https://github.com/Awerkori/manga-extensoes) — Distribuição de extensões para Mihon e forks.
- 💻 [**Project Nox · Código-fonte das Extensões de Mangá**](https://github.com/Awerkori/manga-fonte-extensoes) — Repositório de fontes e CI.
- ⚙️ [**Project Nox · Importer**](https://github.com/Awerkori/project-nox-importer) — Daemon de ingestão e sincronização do catálogo 24/7.
- 🎫 [**Project Nox · Central de Pedidos**](https://github.com/Awerkori/project-nox-requests) — Reporte de bugs e solicitações de conteúdo.
- 📊 [**Project Nox · Tracker**](https://awerkori.github.io/project-nox-tracker/) — Painel de acompanhamento de demandas.
- 👥 [**Project Nox · Central Staff**](https://github.com/Awerkori/project-nox-scan-staff) — Painel editorial para a equipe interna.

---

## 🌟 Créditos e Reconhecimento

- **Project Nox**: Concepção da interface, identidade visual, motor do leitor e infraestrutura da plataforma.
- Equipe de moderadores, colaboradores e equipe de scanlation do Project Nox.

---

## ⚖️ Licença e Responsabilidade

O **Project Nox** desenvolve e disponibiliza ferramentas para estudo e uso comunitário. Não hospedamos materiais protegidos de terceiros de forma centralizada. Consulte os termos e diretrizes na documentação interna.
