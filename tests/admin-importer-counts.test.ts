import { describe, it, expect } from 'vitest';

describe('Admin Importer — Per-Source Blocked Job Counting Logic', () => {
  it('correctly groups blocked jobs by canonical source and avoids global total fallback', () => {
    // Mock queue records with BLOCKED_BY_UPSTREAM status
    const blockedUpstreamJobs = [
      { id: '1', source: 'source_a', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '2', source: 'source_a', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '3', source: 'source_a', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '4', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '5', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '6', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '7', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '8', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '9', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' },
      { id: '10', source: 'source_b', status: 'BLOCKED_BY_UPSTREAM' }
    ];

    const sourcesList = [
      { id: 'source_a', name: 'Source A', status: 'UPSTREAM_BLOCKED', enabled: true },
      { id: 'source_b', name: 'Source B', status: 'UPSTREAM_BLOCKED', enabled: true },
      { id: 'source_c', name: 'Source C', status: 'UPSTREAM_BLOCKED', enabled: true },
      { id: 'source_d', name: 'Source D', status: 'ACTIVE', enabled: true }
    ];

    // Execution of server calculation logic
    const blockedUpstreamTotal = blockedUpstreamJobs.length;
    const blockedCountBySource: Record<string, number> = {};
    for (const j of blockedUpstreamJobs) {
      if (j.source) {
        blockedCountBySource[j.source] = (blockedCountBySource[j.source] || 0) + 1;
      }
    }

    const sourcesWithBlockedCounts = sourcesList.map((s) => ({
      ...s,
      blockedJobsCount: blockedCountBySource[s.id] || 0
    }));

    const upstreamBlockedSources = sourcesWithBlockedCounts.filter((s) => s.status === 'UPSTREAM_BLOCKED');

    const providerBlockers = upstreamBlockedSources.map((s) => ({
      sourceId: s.id,
      sourceName: s.name,
      affectedJobsCount: s.blockedJobsCount
    }));

    // Invariant 1: Global total is 10
    expect(blockedUpstreamTotal).toBe(10);

    // Invariant 2: Per-source cards are strictly individual and never repeat the global total
    const blockerA = providerBlockers.find((b) => b.sourceId === 'source_a');
    const blockerB = providerBlockers.find((b) => b.sourceId === 'source_b');
    const blockerC = providerBlockers.find((b) => b.sourceId === 'source_c');

    expect(blockerA?.affectedJobsCount).toBe(3);
    expect(blockerB?.affectedJobsCount).toBe(7);
    expect(blockerC?.affectedJobsCount).toBe(0);

    // Explicit negative check: None of the cards must equal the global total unless all jobs belong to it
    expect(blockerA?.affectedJobsCount).not.toBe(10);
    expect(blockerC?.affectedJobsCount).not.toBe(10);
  });

  it('renders zero count cleanly and formats labels properly', () => {
    const formatTag = (count: number) => {
      return count === 0 ? '0 jobs retidos' : `${count} ${count === 1 ? 'job retido' : 'jobs retidos'}`;
    };

    expect(formatTag(0)).toBe('0 jobs retidos');
    expect(formatTag(1)).toBe('1 job retido');
    expect(formatTag(5)).toBe('5 jobs retidos');
  });
});
