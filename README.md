# Project Nox · Plataforma Web de Mangá

Plataforma web oficial e leitor online do **Project Nox**, desenvolvida com **SvelteKit**, renderização no Edge via **Cloudflare Workers**, banco de dados principal e persistência relacional via **YugabyteDB (YSQL)** (em instância Sandbox de nó único hospedada na nuvem gerenciada Aeon com conexão otimizada via Cloudflare Hyperdrive), armazenamento externo de mídia via **Telegram Bot API** e suporte transitório/legado a esquemas residuais via **Supabase**.

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
- **Área de Usuário e Gamificação:** Autenticação nativa com persistência em YSQL, sincronização de progresso e histórico de leitura na nuvem, conquistas, molduras colecionáveis e personalização visual de perfil.
- **Arquitetura Serverless Resiliente:** Execução no Cloudflare Workers com uso inteligente de conexões, pooling defensivo e proteção contra indisponibilidades transitórias.

---

## 🏛️ Arquitetura e Tabela de Responsabilidades

| Camada | Tecnologia / Provedor | Responsabilidade Técnica |
| :--- | :--- | :--- |
| **Interface & SSR** | SvelteKit (`@sveltejs/kit`) | Renderização Server-Side (SSR) no Edge, interface responsiva e motor do leitor |
| **Runtime de Borda** | Cloudflare Workers | Execução serverless de baixa latência e proxy de entrega de mídia sob demanda (`/media/[id]`) |
| **Banco de Dados Principal** | YugabyteDB / YSQL (Sandbox Aeon) | Catálogo oficial, metadados de capítulos e páginas, histórico de leitura, gamificação e controle de sessões |
| **Conexão SQL / Pooling** | Cloudflare Hyperdrive & `pg` | Multiplexação de conexões com `withYugabyteReadSession`, cache Last-Known-Good (LKG) e fallback para gateway interno |
| **Armazenamento de Mídia** | Telegram Bot API | Armazenamento externo particionado de blobs de imagens (canais/shards) desacoplado do banco relacional |
| **Autenticação & Sessões** | Nativa YSQL & Web Crypto API | Autenticação por e-mail/senha com `crypt()`, sessões em JWTs HS256 e cookies `nox-auth-token` |
| **Ingestão Contínua** | [`project-nox-importer`](https://github.com/Awerkori/project-nox-importer) | Daemon autônomo 24/7 responsável por rastreamento, download, validação binária de imagens e carga no YSQL |
| **Camada Legada / Transição** | Supabase (PostgreSQL) | Esquemas transitórios e compatibilidade legada; não atua como banco de dados principal nem provedor ativo de autenticação |

---

## 🗄️ Banco de Dados Principal (YugabyteDB / YSQL)

O banco de dados autoritativo de produção da plataforma é o **YugabyteDB (YSQL)**, provisionado como instância **Sandbox de nó único** na nuvem gerenciada **Aeon**.

> [!IMPORTANT]
> **Nota de Topologia:** O ambiente de banco de dados atual opera sobre uma instância Sandbox de nó único, sujeita a um limite restrito de slots de conexão simultâneos (`max_connections = 13` no nó gerenciado). Para garantir estabilidade e evitar saturação:
> - O site utiliza multiplexação de conexões por requisição (`withYugabyteReadSession`, com concorrência máxima de 1 a 2 conexões por ciclo de SSR).
> - Em ambiente Node/SSR, o `sharedPool` é estritamente limitado a 3 conexões.
> - Consultas críticas utilizam estratégia de cache Last-Known-Good (LKG) em memória para prevenir que eventuais oscilações de conexão derrubem páginas públicas de leitura.
> - Esta infraestrutura **não** deve ser descrita como um cluster de alta disponibilidade ou multi-nó.

A conexão em produção no Cloudflare Workers é intermediada pelo **Cloudflare Hyperdrive**, que acelera conexões PostgreSQL no Edge mantendo pools aquecidos. Caso o binding Hyperdrive não esteja configurado, a aplicação recorre automaticamente ao gateway interno do Importer via rota autenticada.

---

## 🔐 Fluxo de Autenticação, Sessões e Segurança

1. **Validação de Credenciais no YSQL:**
   - O login por e-mail e senha consulta diretamente a tabela `auth.users` do YugabyteDB.
   - A senha fornecida é comparada criptograficamente via extensão `pgcrypto` (`encrypted_password = crypt($2, encrypted_password)`).
   - O login exige confirmação prévia de e-mail (`email_confirmed_at IS NOT NULL`).

2. **Emissão de Sessão JWT (Web Crypto API):**
   - Autenticado com sucesso, o servidor gera um JWT padrão HS256 assinado com segredos criptográficos gerenciados no ambiente (`AUTH_SECRET` / `JWT_SECRET`).
   - O token contém a identificação do usuário (`sub`), e-mail, perfil e expiração configurada para 30 dias.

3. **Gerenciamento de Cookies e Renovação Deslizante:**
   - O token é armazenado no cookie seguro `nox-auth-token`.
   - No ciclo de vida de requisições (`hooks.server.ts`), o token é validado por assinatura criptográfica sem requisições adicionais de rede para checagem externa de JWT.
   - O sistema implementa renovação deslizante (sliding renewal): se a sessão válida estiver a menos de 7 dias de expirar, um novo JWT com validade estendida de 30 dias é gerado automaticamente.

4. **Desacoplamento do Supabase (Política Supabase Zero para Sessões):**
   - Sessões e autenticações são estritamente gerenciadas pela autoridade YSQL.
   - Tokens emitidos originalmente pelo Supabase ou com referências a projetos legados são explicitamente rejeitados na camada de autorização.
   - Cookies legados (`sb-*-auth-token`) são automaticamente limpos quando inválidos.

---

## 🖼️ Integração entre Site, Importer, YSQL e Telegram

A entrega de imagens e capítulos da plataforma opera em desacoplamento estrito entre metadados relacionais e blobs binários:

1. **Separação de Mídia e Metadados:**
   - O banco YugabyteDB **não** armazena os arquivos binários de imagem para proteger o desempenho e espaço em disco do banco de dados relacional.
   - O YSQL armazena metadados estruturados: registros na tabela `media` com dimensões (`width`, `height`), tipo MIME, hash SHA-256 e o identificador externo `provider_key` (o `file_id` do Telegram).
   - A tabela `pages` mapeia cada página do capítulo (`chapter_id`, `position`, `media_id`).

2. **Papel do Importer:**
   - O serviço daemon [`project-nox-importer`](https://github.com/Awerkori/project-nox-importer) executa 24/7 na Discloud, monitora fontes de catálogo, faz o download das páginas, valida a integridade de seus cabeçalhos binários e realiza o upload para canais particionados (shards) do Telegram via Telegram Bot API.
   - Ao concluir a validação completa de todas as páginas de um capítulo, o Importer grava os metadados no YugabyteDB e publica o capítulo através de uma barreira atômica.

3. **Streaming ao Leitor (`/media/[id]`):**
   - O leitor web solicita as páginas através da rota `/media/[id]`.
   - O Cloudflare Worker consulta os metadados no YugabyteDB para obter a chave do provedor e referências de bot/shard.
   - O Worker faz o download do stream de bytes via Telegram Bot API através de bots distribuídos com controle de concorrência e o transmite diretamente ao leitor web com cabeçalhos adequados de cache.

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
# Preencha as variáveis de ambiente necessárias conforme descrito abaixo
```

### Execução Local
```bash
# Iniciar servidor de desenvolvimento local
npm run dev
```

### Validações e Testes
```bash
npm run check         # Verificação de tipos TypeScript e integridade Svelte
npm test              # Execução da suíte completa de testes unitários (Vitest)
npm run build         # Build de produção para Cloudflare Workers
```

---

## 🔑 Variáveis de Ambiente e Segurança

As configurações da aplicação são gerenciadas via variáveis de ambiente no arquivo `.env` (desenvolvimento local) ou secrets do Cloudflare Workers (produção):

| Variável | Escopo | Descrição |
| :--- | :--- | :--- |
| `PUBLIC_SITE_URL` | Público | URL base pública da plataforma (ex.: `http://localhost:5173` ou URL em produção) |
| `PUBLIC_SUPABASE_URL` | Público | Endpoint público mantido para rotas de compatibilidade transitória |
| `PUBLIC_SUPABASE_ANON_KEY`| Público | Chave pública anônima mantida para compatibilidade legada |
| `AUTH_SECRET` / `JWT_SECRET` | Backend / Privado | Segredos criptográficos utilizados pelo Web Crypto API para assinar e validar JWTs de sessão |
| `HYPERDRIVE` | Cloudflare Binding | Binding nativo do Cloudflare Workers para conexão transacional direta com YugabyteDB / YSQL |
| `NOX_STORAGE_BRIDGE_TOKEN` | Backend / Privado | Token de autenticação interna para o gateway do Importer quando o Hyperdrive não estiver presente |
| `NOX_IMPORTER_GATEWAY_URL` | Backend / Privado | Endpoint do gateway interno do Importer para contingência de consultas SQL |

> [!WARNING]
> Segredos de autenticação (`AUTH_SECRET`, `JWT_SECRET`), tokens internos de serviço, certificados SSL e credenciais administrativas **nunca** devem ser versionados em código ou expostos no bundle do cliente.

---

## 🔗 Ecossistema Project Nox

- 📦 [**Project Nox · Extensões de Mangá**](https://github.com/Awerkori/manga-extensoes) — Distribuição de extensões para Mihon e forks.
- 💻 [**Project Nox · Código-fonte das Extensões de Mangá**](https://github.com/Awerkori/manga-fonte-extensoes) — Repositório de fontes em Kotlin e esteiras de CI.
- ⚙️ [**Project Nox · Importer**](https://github.com/Awerkori/project-nox-importer) — Daemon de ingestão e sincronização do catálogo 24/7.
- 🎫 [**Project Nox · Central de Pedidos**](https://github.com/Awerkori/project-nox-requests) — Central de chamados e solicitações da comunidade.
- 📊 [**Project Nox · Tracker**](https://awerkori.github.io/project-nox-tracker/) — Painel de acompanhamento de demandas.
- 👥 [**Project Nox · Central Staff**](https://github.com/Awerkori/project-nox-scan-staff) — Painel editorial para equipes internas.

---

## 🌟 Créditos e Reconhecimento

- **Project Nox**: Concepção da interface, identidade visual, motor do leitor e infraestrutura da plataforma.
- Equipe de moderadores, colaboradores e equipes de scanlation participantes do Project Nox.

---

## ⚖️ Licenciamento e Avisos Legais

Este projeto é software livre licenciado sob os termos da **GNU Affero General Public License versão 3.0** (`AGPL-3.0-only`). Consulte o arquivo [LICENSE](LICENSE) para obter o texto integral inalterado da licença e o arquivo [NOTICE](NOTICE) para informações detalhadas de autoria, dependências e governança.

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
A concessão da licença AGPLv3 refere-se estritamente aos direitos autorais do software. Os nomes "Project Nox" e "Awerkori", bem como logotipos associados, identificam a procedência e origem do projeto. Em conformidade com a Seção 7(e) da GNU AGPLv3, a licença **não concede** autorização para uso de nomes, marcas ou logotipos para insinuar homologação, endosso ou representação oficial sem autorização prévia por escrito.

### ⚖️ Aviso Legal sobre Software, Instalações e Conteúdos Externos

1. **Finalidade e Escopo Estrito deste Repositório:**
   O presente repositório GitHub (`Awerkori/project-nox-manga`) tem por objetivo exclusivo disponibilizar o código-fonte aberto da plataforma web e leitor de mangá do Project Nox. Este repositório de software **não funciona, não foi concebido e não deve ser operado como repositório de obras intelectuais de terceiros**, capítulos, mangás ou quadrinhos protegidos.

2. **Distinção entre Software Aberto e Instalações Independentes:**
   Qualquer pessoa ou entidade é livre para inspecionar, copiar, bifurcar (fork) e instalar o software aqui disponibilizado em conformidade com a licença GNU AGPLv3. No entanto, uma instalação ou instância em execução mantida por terceiros em infraestrutura própria constitui um serviço operacional totalmente independente deste repositório de código. A responsabilidade pela administração de qualquer instância em operação, bem como pelas fontes de catálogo selecionadas, rotinas de ingestão habilitadas e arquivos de mídia armazenados ou servidos por essa infraestrutura, pertence exclusiva e integralmente ao operador responsável por essa instalação, devendo ser analisada sob a sua conduta específica e a legislação aplicável.

3. **Limites do Licenciamento de Software:**
   A GNU Affero General Public License v3.0 outorga direitos e liberdades estritamente sobre o código-fonte, a arquitetura e os scripts de software que compõem a plataforma. **A licença AGPLv3 não concede, não transfere e não implica qualquer autorização, licença de direitos autorais ou cessão de direitos sobre mangás, quadrinhos, ilustrações, traduções ou quaisquer outras obras intelectuais de terceiros** que venham a ser processadas, referenciadas ou exibidas em uma instalação concreta da plataforma.

4. **Capacidades Técnicas e Ausência de Imunidade Automática:**
   O software implementa funcionalidades concebidas para permitir a indexação técnica, a consulta a bancos de dados relacionais e a exibição de fluxos de imagem a partir de provedores externos de armazenamento configurados por seu operador. O código-fonte aberto da plataforma não confere imunidade automática a obrigações legais ou de propriedade intelectual, devendo qualquer operador respeitar rigorosamente as normas de direitos autorais e as prerrogativas dos titulares das obras nos termos da legislação cabível.
