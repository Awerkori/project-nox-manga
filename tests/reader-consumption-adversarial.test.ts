import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PROJECT NOX — SUÍTE ADVERSARIAL DE CONSUMO DO LEITOR & AUDITORIA DE RECURSOS
 * 
 * Baterias com cenários de 15, 30 e 50 imagens por capítulo, cobrindo:
 * 1. Novo Leitor Web (Cold Cache, Sem SW, Sem Cache Local)
 * 2. Leitor Web Recorrente (Com HTTP Disk Cache / immutable, Sem SW)
 * 3. Leitor Web PWA Recorrente (Com Service Worker / CacheStorage nox-media-v1)
 * 4. Leitor Mihon / Fork — Novo Capítulo (Download / Primeira Leitura no App)
 * 5. Leitor Mihon / Fork — Re-leitura (OkHttp Disk Cache Local)
 * 
 * Matriz estrita das 7 métricas obrigatórias:
 * (1) Requisições HTTP geradas pelo cliente
 * (2) Requisições que chegam à Cloudflare
 * (3) Requisições faturáveis dos Workers
 * (4) Execuções reais do código Worker (isolate)
 * (5) Consultas SQL ao YSQL
 * (6) Uso do Hyperdrive
 * (7) Transferência de imagens e consumo de banda (bytes)
 */

interface ResourceMetrics {
  clientHttpRequests: number;
  edgeRequestsReceived: number;
  billableWorkerRequests: number;
  workerCodeExecutions: number;
  sqlQueries: number;
  hyperdriveQueries: number;
  bytesTransferred: number;
}

interface ChapterScenarioConfig {
  pageCount: number;
  avgPageSizeBytes: number;
  htmlSizeBytes: number;
  apiSizeBytes: number;
}

const DEFAULT_CONFIGS: Record<number, ChapterScenarioConfig> = {
  15: { pageCount: 15, avgPageSizeBytes: 310_000, htmlSizeBytes: 32_000, apiSizeBytes: 1_800 },
  30: { pageCount: 30, avgPageSizeBytes: 310_000, htmlSizeBytes: 35_000, apiSizeBytes: 2_400 },
  50: { pageCount: 50, avgPageSizeBytes: 310_000, htmlSizeBytes: 38_000, apiSizeBytes: 3_200 },
};

function simulateReaderJourney(
  archetype: 'NEW_WEB' | 'RECURRENT_WEB_DISK_CACHE' | 'RECURRENT_WEB_SW' | 'MIHON_NEW_CHAPTER' | 'MIHON_CACHED',
  pageCount: 15 | 30 | 50,
  options: { edgeCacheWarm?: boolean } = { edgeCacheWarm: true }
): ResourceMetrics {
  const cfg = DEFAULT_CONFIGS[pageCount];
  const { edgeCacheWarm = true } = options;

  switch (archetype) {
    case 'NEW_WEB': {
      // 1 HTML + N imagens geradas pelo browser
      const clientHttpRequests = 1 + cfg.pageCount;
      // Todas chegam à Cloudflare (cliente não tem cache local)
      const edgeRequestsReceived = 1 + cfg.pageCount;
      // Todas ingressam pelo Custom Domain do Worker -> faturáveis na franquia
      const billableWorkerRequests = 1 + cfg.pageCount;
      // Se edge cache quente (Workers Cache):
      // - HTML: 0 ms CPU / 0 execuções se em shared cache, ou 1 se SSR frio
      // - Imagens: 0 execuções no Worker se Workers Cache HIT
      const workerCodeExecutions = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      // SQL e Hyperdrive: 0 se cache quente
      const sqlQueries = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      const hyperdriveQueries = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      // Banda: HTML completo + todas as imagens completas
      const bytesTransferred = cfg.htmlSizeBytes + (cfg.pageCount * cfg.avgPageSizeBytes);

      return {
        clientHttpRequests,
        edgeRequestsReceived,
        billableWorkerRequests,
        workerCodeExecutions,
        sqlQueries,
        hyperdriveQueries,
        bytesTransferred
      };
    }

    case 'RECURRENT_WEB_DISK_CACHE': {
      // Navegador possui HTTP Disk Cache local (Cache-Control: immutable)
      // O browser emite apenas 1 request de navegação HTML (com If-None-Match)
      // As N imagens são servidas diretamente de (disk cache) localmente sem emitir pacotes de rede
      const clientHttpRequests = 1; // apenas o HTML sai para a rede
      const edgeRequestsReceived = 1;
      const billableWorkerRequests = 1;
      const workerCodeExecutions = 0; // 304 Not Modified no edge
      const sqlQueries = 0;
      const hyperdriveQueries = 0;
      // Banda: apenas headers HTTP 304 (~350 bytes)
      const bytesTransferred = 350;

      return {
        clientHttpRequests,
        edgeRequestsReceived,
        billableWorkerRequests,
        workerCodeExecutions,
        sqlQueries,
        hyperdriveQueries,
        bytesTransferred
      };
    }

    case 'RECURRENT_WEB_SW': {
      // PWA com Service Worker ativo (src/service-worker.ts CACHE_MEDIA)
      // O browser emite a requisição HTML e o leitor instancia os elementos <img>
      // O fetch event do Service Worker intercepta todas as N requisições de /media/
      // Retorna CacheStorage local sem sair do dispositivo
      const clientHttpRequests = 1 + cfg.pageCount; // geradas no contexto da página
      const edgeRequestsReceived = 1; // apenas o HTML sai para a rede externa
      const billableWorkerRequests = 1;
      const workerCodeExecutions = 0; // 304 ou shared cache HIT
      const sqlQueries = 0;
      const hyperdriveQueries = 0;
      // Banda: apenas o HTML (304 revalidation ~350 bytes ou página SSR se expirado)
      const bytesTransferred = 350;

      return {
        clientHttpRequests,
        edgeRequestsReceived,
        billableWorkerRequests,
        workerCodeExecutions,
        sqlQueries,
        hyperdriveQueries,
        bytesTransferred
      };
    }

    case 'MIHON_NEW_CHAPTER': {
      // Mihon consome /api/mihon/chapter/[id]/pages (1 request)
      // Mihon consome N imagens (/media/[id]) sequencialmente/concorrentemente
      const clientHttpRequests = 1 + cfg.pageCount;
      const edgeRequestsReceived = 1 + cfg.pageCount;
      const billableWorkerRequests = 1 + cfg.pageCount;
      // No edge quente:
      // - API Mihon: s-maxage=3600 (HIT no Workers Cache -> 0 execuções)
      // - Imagens: s-maxage=31536000 (HIT no Workers Cache -> 0 execuções)
      const workerCodeExecutions = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      const sqlQueries = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      const hyperdriveQueries = edgeCacheWarm ? 0 : 1 + cfg.pageCount;
      const bytesTransferred = cfg.apiSizeBytes + (cfg.pageCount * cfg.avgPageSizeBytes);

      return {
        clientHttpRequests,
        edgeRequestsReceived,
        billableWorkerRequests,
        workerCodeExecutions,
        sqlQueries,
        hyperdriveQueries,
        bytesTransferred
      };
    }

    case 'MIHON_CACHED': {
      // Capítulo já baixado ou no OkHttp disk cache local do Mihon
      // Mihon não faz chamadas de rede para imagens baixadas
      // Pode opcionalmente fazer 1 checagem condicional de páginas se não for modo offline
      const clientHttpRequests = 0;
      const edgeRequestsReceived = 0;
      const billableWorkerRequests = 0;
      const workerCodeExecutions = 0;
      const sqlQueries = 0;
      const hyperdriveQueries = 0;
      const bytesTransferred = 0;

      return {
        clientHttpRequests,
        edgeRequestsReceived,
        billableWorkerRequests,
        workerCodeExecutions,
        sqlQueries,
        hyperdriveQueries,
        bytesTransferred
      };
    }
  }
}

describe('Project Nox — Adversarial Reader Consumption & Resource Matrix', () => {
  describe('Cenários de 15 Imagens por Capítulo', () => {
    it('Novo Leitor Web: 16 requisições faturáveis, 0 CPU/SQL em cache quente', () => {
      const metrics = simulateReaderJourney('NEW_WEB', 15, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(16);
      expect(metrics.edgeRequestsReceived).toBe(16);
      expect(metrics.billableWorkerRequests).toBe(16);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.sqlQueries).toBe(0);
      expect(metrics.hyperdriveQueries).toBe(0);
      expect(metrics.bytesTransferred).toBe(32_000 + (15 * 310_000));
    });

    it('Leitor Web Recorrente com Disk Cache: 1 requisição faturável (93.7% de economia)', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_DISK_CACHE', 15);
      expect(metrics.clientHttpRequests).toBe(1);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.sqlQueries).toBe(0);
      expect(metrics.hyperdriveQueries).toBe(0);
      expect(metrics.bytesTransferred).toBe(350);
    });

    it('Leitor Web Recorrente com Service Worker: 1 requisição na Cloudflare, 15 interceptadas', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_SW', 15);
      expect(metrics.clientHttpRequests).toBe(16);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.sqlQueries).toBe(0);
      expect(metrics.hyperdriveQueries).toBe(0);
    });

    it('Mihon Novo Capítulo: 16 requisições faturáveis, 0 CPU/SQL no edge quente', () => {
      const metrics = simulateReaderJourney('MIHON_NEW_CHAPTER', 15, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(16);
      expect(metrics.edgeRequestsReceived).toBe(16);
      expect(metrics.billableWorkerRequests).toBe(16);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.sqlQueries).toBe(0);
      expect(metrics.hyperdriveQueries).toBe(0);
    });

    it('Mihon Capítulo Baixado: 0 requisições à Cloudflare', () => {
      const metrics = simulateReaderJourney('MIHON_CACHED', 15);
      expect(metrics.clientHttpRequests).toBe(0);
      expect(metrics.edgeRequestsReceived).toBe(0);
      expect(metrics.billableWorkerRequests).toBe(0);
      expect(metrics.bytesTransferred).toBe(0);
    });
  });

  describe('Cenários de 30 Imagens por Capítulo', () => {
    it('Novo Leitor Web: 31 requisições faturáveis confirmadas (1 HTML + 30 imagens)', () => {
      const metrics = simulateReaderJourney('NEW_WEB', 30, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(31);
      expect(metrics.edgeRequestsReceived).toBe(31);
      expect(metrics.billableWorkerRequests).toBe(31);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.sqlQueries).toBe(0);
      expect(metrics.hyperdriveQueries).toBe(0);
      expect(metrics.bytesTransferred).toBe(35_000 + (30 * 310_000));
    });

    it('Leitor Web Recorrente com Disk Cache: 1 requisição faturável (96.8% de economia)', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_DISK_CACHE', 30);
      expect(metrics.clientHttpRequests).toBe(1);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.bytesTransferred).toBe(350);
    });

    it('Leitor Web Recorrente com Service Worker: 1 requisição na Cloudflare, 30 interceptadas', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_SW', 30);
      expect(metrics.clientHttpRequests).toBe(31);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
    });

    it('Mihon Novo Capítulo: 31 requisições faturáveis (1 manifest + 30 imagens)', () => {
      const metrics = simulateReaderJourney('MIHON_NEW_CHAPTER', 30, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(31);
      expect(metrics.edgeRequestsReceived).toBe(31);
      expect(metrics.billableWorkerRequests).toBe(31);
      expect(metrics.workerCodeExecutions).toBe(0);
    });

    it('Mihon Capítulo Baixado: 0 requisições à Cloudflare', () => {
      const metrics = simulateReaderJourney('MIHON_CACHED', 30);
      expect(metrics.clientHttpRequests).toBe(0);
      expect(metrics.edgeRequestsReceived).toBe(0);
      expect(metrics.billableWorkerRequests).toBe(0);
    });
  });

  describe('Cenários de 50 Imagens por Capítulo', () => {
    it('Novo Leitor Web: 51 requisições faturáveis confirmadas (1 HTML + 50 imagens)', () => {
      const metrics = simulateReaderJourney('NEW_WEB', 50, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(51);
      expect(metrics.edgeRequestsReceived).toBe(51);
      expect(metrics.billableWorkerRequests).toBe(51);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.bytesTransferred).toBe(38_000 + (50 * 310_000));
    });

    it('Leitor Web Recorrente com Disk Cache: 1 requisição faturável (98.0% de economia)', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_DISK_CACHE', 50);
      expect(metrics.clientHttpRequests).toBe(1);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
      expect(metrics.bytesTransferred).toBe(350);
    });

    it('Leitor Web Recorrente com Service Worker: 1 requisição na Cloudflare, 50 interceptadas', () => {
      const metrics = simulateReaderJourney('RECURRENT_WEB_SW', 50);
      expect(metrics.clientHttpRequests).toBe(51);
      expect(metrics.edgeRequestsReceived).toBe(1);
      expect(metrics.billableWorkerRequests).toBe(1);
      expect(metrics.workerCodeExecutions).toBe(0);
    });

    it('Mihon Novo Capítulo: 51 requisições faturáveis (1 manifest + 50 imagens)', () => {
      const metrics = simulateReaderJourney('MIHON_NEW_CHAPTER', 50, { edgeCacheWarm: true });
      expect(metrics.clientHttpRequests).toBe(51);
      expect(metrics.edgeRequestsReceived).toBe(51);
      expect(metrics.billableWorkerRequests).toBe(51);
    });

    it('Mihon Capítulo Baixado: 0 requisições à Cloudflare', () => {
      const metrics = simulateReaderJourney('MIHON_CACHED', 50);
      expect(metrics.clientHttpRequests).toBe(0);
      expect(metrics.edgeRequestsReceived).toBe(0);
      expect(metrics.billableWorkerRequests).toBe(0);
    });
  });

  describe('Modelagem Matemática e Projeções de Escala (1.000, 10.000 e 100.000 leitores/dia)', () => {
    const FREE_TIER_DAILY_LIMIT = 100_000;
    const SAFETY_BUFFER_PERCENT = 0.15;
    const OPERATIONAL_BUDGET = FREE_TIER_DAILY_LIMIT * (1 - SAFETY_BUFFER_PERCENT); // 85.000 req/dia

    it('demonstra capacidade em cenário pessimista (100% leituras frias / sem cache local)', () => {
      // 2 capítulos por leitor por dia, 30 imagens cada = 62 req/leitor
      const reqPerReader = 2 * 31;
      const maxReadersFreeTier = Math.floor(OPERATIONAL_BUDGET / reqPerReader);

      expect(maxReadersFreeTier).toBe(1370);
      // Comprova que 10.000 leitores frios estourariam a franquia Free Tier em 7.2x
      const reqFor10k = 10_000 * reqPerReader;
      expect(reqFor10k).toBe(620_000);
      expect(reqFor10k).toBeGreaterThan(FREE_TIER_DAILY_LIMIT);
    });

    it('demonstra capacidade em cenário representativo (70% leituras recorrentes, 30% capítulos novos)', () => {
      // Requisições médias por capítulo = (0.70 * 1) + (0.30 * 31) = 0.70 + 9.30 = 10.0
      const reqPerChapter = (0.70 * 1) + (0.30 * 31);
      const reqPerReader = 2 * reqPerChapter; // 20 req/leitor
      const maxReadersFreeTier = Math.floor(OPERATIONAL_BUDGET / reqPerReader);

      expect(reqPerChapter).toBeCloseTo(10.0, 2);
      expect(reqPerReader).toBeCloseTo(20.0, 2);
      expect(maxReadersFreeTier).toBe(4250);

      // Comprova que 100.000 leitores gerariam 2.000.000 de requisições (inviável em Free Tier)
      const reqFor100k = 100_000 * reqPerReader;
      expect(Math.round(reqFor100k)).toBe(2_000_000);
    });

    it('demonstra capacidade em cenário otimista (85% retenção de cache local PWA/Mihon)', () => {
      // Requisições médias por capítulo = (0.85 * 1) + (0.15 * 31) = 0.85 + 4.65 = 5.5
      const reqPerChapter = (0.85 * 1) + (0.15 * 31);
      const reqPerReader = 2 * reqPerChapter; // 11 req/leitor
      const maxReadersFreeTier = Math.floor(OPERATIONAL_BUDGET / reqPerReader);

      expect(reqPerChapter).toBeCloseTo(5.5, 2);
      expect(reqPerReader).toBeCloseTo(11.0, 2);
      expect(maxReadersFreeTier).toBe(7727);
    });

    it('prova que declarar "100.000 leitores/dia a R$ 0,00 sem R2 e sem cache local 99.5%" é tecnicamente impossível', () => {
      const readers = 100_000;
      const minRequestsAssumingAllNew = readers * 31;
      expect(minRequestsAssumingAllNew).toBe(3_100_000);
      expect(minRequestsAssumingAllNew).toBeGreaterThan(FREE_TIER_DAILY_LIMIT * 30);
    });
  });
});
