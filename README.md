# Project Nox · Plataforma Web de Mangá

Plataforma web oficial e leitor online do **Project Nox**, desenvolvida com **SvelteKit**, renderização no Edge via **Cloudflare Workers**, banco de dados principal e persistência de leitura via **YugabyteDB (YSQL)**, entrega de mídia via **Telegram** e suporte à autenticação/transição via **Supabase**.

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
- **Banco de Dados Principal:** YugabyteDB (YSQL distribuído de alta disponibilidade)
- **Armazenamento de Mídia:** Telegram Bot API
- **Autenticação & Legado:** Supabase (PostgreSQL / transição de sessões e autenticação)
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

Este projeto é software livre licenciado sob os termos da **GNU Affero General Public License versão 3.0** (`AGPL-3.0-only`). Consulte o arquivo [LICENSE](LICENSE) para obter o texto integral inalterado da licença e o arquivo [NOTICE](NOTICE) para informações detalhadas de autoria, componentes de terceiros e termos de governança.

```
Copyright (C) 2026 Project Nox Contributors & Awerkori

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
```

### 📌 Interação Remota de Rede (GNU AGPLv3 Seção 13)
O Project Nox adota oficialmente a licença **GNU AGPL versão 3.0**. Nos termos da Seção 13 da AGPLv3, qualquer versão modificada desta plataforma operada em servidores ou instâncias acessíveis remotamente através de uma rede de computadores deve oferecer a todos os usuários remotos a oportunidade de obter o Código-Fonte Correspondente (Corresponding Source) da aplicação em execução, sem cobrança e por meio padrão de transmissão de software.

### 🛡️ Proteção de Identidade e Marca (AGPLv3 Seção 7(e))
A concessão da licença AGPLv3 refere-se estritamente aos direitos autorais do software. Os nomes "Project Nox" e "Awerkori", bem como logotipos associados, identificam a procedência e origem do projeto. A licença **não concede** autorização para uso de nomes, marcas ou logotipos para insinuar homologação, endosso ou representação oficial sem autorização prévia por escrito.

### ⚖️ Isenção de Responsabilidade
O **Project Nox** desenvolve e disponibiliza ferramentas exclusivamente para estudo, interoperabilidade técnica e pesquisa de agregação. O projeto não hospeda, gerencia nem armazena arquivos protegidos de terceiros em seus servidores centrais.
