# API pública v1

GET /api/v1/works?q=texto&page=1

GET /api/v1/works/{slug}

GET /api/v1/works/{slug}/chapters?page=1

GET /api/v1/chapters/{uuid}/pages

Respostas JSON, paginação de 30 obras/capítulos. Cada página contém posição, dimensões e URL de imagem. Somente obras e capítulos publicados. Sem credenciais, dados da central, chaves de storage ou endpoints administrativos. CORS permite leitura por extensões futuras. Métodos de escrita não são implementados em v1.

O detalhe da obra inclui `work_tags`, uma lista de `{ tags: { id, name, slug, kind } }`. `kind` distingue `GENRE` de `TAG`. Essa relação contém apenas a taxonomia pública da obra consultada.

As páginas de obra também oferecem dados estruturados [ComicSeries](https://schema.org/ComicSeries) e breadcrumbs. Não são inventadas avaliações, autoria ou titularidade. O JSON-LD escapa delimitadores HTML antes de ser inserido no documento.

# Fonte de verdade editorial

A central origina o cadastro e mantém o workflow de produção. A importação é idempotente por source_id e cria rascunhos. Após importar, o catálogo público mantém os metadados editoriais destinados ao leitor; reimportações não sobrescrevem o trabalho do editor. Não é necessário cadastrar a obra novamente.

O seletor de capítulos da central verifica READY/COMPLETED no servidor e entrega exclusivamente o arquivo de TYPESET/REVIEW mais recente. Links temporários desses arquivos finais são acessíveis apenas a editores autenticados. RAW, Clean, tradução, comentários, rejeições e tarefas não são importados.

Publicação no site é uma ação explícita após upload e conferência. A aplicação não altera o workflow nem as migrations da central.
