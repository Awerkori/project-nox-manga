// src/lib/scan-roles.ts
// Centralized configuration for Project Nox Scan Management & Editorial Pipeline

export type ScanAdminRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface ScanAdminFunctionConfig {
  role: ScanAdminRole;
  label: string;
  icon: string;
  description: string;
  isAssignableByManager: boolean;
}

export const SCAN_ADMIN_FUNCTIONS: Record<ScanAdminRole, ScanAdminFunctionConfig> = {
  OWNER: {
    role: 'OWNER',
    label: 'Dono',
    icon: '👑',
    description: 'Dono e fundador da Scan. Cargo único, não atribuível por gerenciador.',
    isAssignableByManager: false
  },
  ADMIN: {
    role: 'ADMIN',
    label: 'Gerente',
    icon: '🛡️',
    description: 'Função administrativa. Gerencia equipe, tarefas e produção.',
    isAssignableByManager: false // Only Owner can promote Staff -> Gerente
  },
  MEMBER: {
    role: 'MEMBER',
    label: 'Staff',
    icon: '👤',
    description: 'Membro comum da Scan. Atua conforme seus cargos editoriais.',
    isAssignableByManager: true
  }
};

export interface ScanEditorialRoleConfig {
  slug: string;
  name: string;
  icon: string;
  description: string;
  display_order: number;
  stage_slug: string;
  stage_name: string;
}

export const CANONICAL_EDITORIAL_ROLES: ScanEditorialRoleConfig[] = [
  {
    slug: 'raw_provider',
    name: 'Raw Provider',
    icon: '📦',
    description: 'Obtenção e tratamento dos arquivos brutos em alta resolução.',
    display_order: 1,
    stage_slug: 'raw',
    stage_name: 'Raw Provider'
  },
  {
    slug: 'tradutor',
    name: 'Tradutor',
    icon: '🌐',
    description: 'Tradução e localização fiel dos diálogos e narrativas.',
    display_order: 2,
    stage_slug: 'traducao',
    stage_name: 'Tradução'
  },
  {
    slug: 'clean_redraw',
    name: 'Clean/Redraw',
    icon: '🎨',
    description: 'Limpeza dos balões e reconstrução artística de fundos.',
    display_order: 3,
    stage_slug: 'clean_redraw',
    stage_name: 'Clean/Redraw'
  },
  {
    slug: 'typer',
    name: 'Typer',
    icon: '✒️',
    description: 'Diagramação tipográfica e formatação de falas e efeitos sonoros.',
    display_order: 4,
    stage_slug: 'typeset',
    stage_name: 'Typeset'
  },
  {
    slug: 'revisor_qc',
    name: 'Revisor (QC)',
    icon: '🔎',
    description: 'Revisão gramatical, coesão editorial e controle de qualidade.',
    display_order: 5,
    stage_slug: 'revisor_qc',
    stage_name: 'Revisor (QC)'
  }
];

export interface PipelineStageConfig {
  slug: string;
  name: string;
  icon: string;
  display_order: number;
  requiredRoleName: string | null;
  requiredRoleSlug: string | null;
  dependencies: string[];
  requiresOutput: boolean;
  color: string;
  description: string;
  adminOnly?: boolean;
  isFinal?: boolean;
}

export const CANONICAL_PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    slug: 'raw',
    name: 'Raw Provider',
    icon: '📦',
    display_order: 1,
    requiredRoleName: 'Raw Provider',
    requiredRoleSlug: 'raw_provider',
    dependencies: [],
    requiresOutput: true,
    color: '#64748b',
    description: 'Upload dos arquivos brutos e preparação das páginas para o pipeline.'
  },
  {
    slug: 'traducao',
    name: 'Tradução',
    icon: '🌐',
    display_order: 2,
    requiredRoleName: 'Tradutor',
    requiredRoleSlug: 'tradutor',
    dependencies: ['raw'],
    requiresOutput: true,
    color: '#3b82f6',
    description: 'Tradução do texto original preservando termos do glossário.'
  },
  {
    slug: 'clean_redraw',
    name: 'Clean/Redraw',
    icon: '🎨',
    display_order: 3,
    requiredRoleName: 'Clean/Redraw',
    requiredRoleSlug: 'clean_redraw',
    dependencies: ['raw'],
    requiresOutput: true,
    color: '#ec4899',
    description: 'Limpeza dos balões e reconstrução artística dos fundos.'
  },
  {
    slug: 'typeset',
    name: 'Typeset',
    icon: '✒️',
    display_order: 4,
    requiredRoleName: 'Typer',
    requiredRoleSlug: 'typer',
    dependencies: ['traducao', 'clean_redraw'],
    requiresOutput: true,
    color: '#eab308',
    description: 'Inserção tipográfica da tradução sobre as páginas limpas.'
  },
  {
    slug: 'revisor_qc',
    name: 'Revisor (QC)',
    icon: '🔎',
    display_order: 5,
    requiredRoleName: 'Revisor (QC)',
    requiredRoleSlug: 'revisor_qc',
    dependencies: ['typeset'],
    requiresOutput: false,
    color: '#a855f7',
    description: 'Inspeção de qualidade e revisão minuciosa antes da aprovação.'
  },
  {
    slug: 'pre_aprovado',
    name: 'Pré Aprovado',
    icon: '✅',
    display_order: 6,
    requiredRoleName: null,
    requiredRoleSlug: null,
    dependencies: ['revisor_qc'],
    requiresOutput: false,
    color: '#10b981',
    description: 'Capítulo revisado aguardando autorização da liderança para publicação.',
    adminOnly: true
  },
  {
    slug: 'publicado',
    name: 'Publicado',
    icon: '📚',
    display_order: 7,
    requiredRoleName: null,
    requiredRoleSlug: null,
    dependencies: ['pre_aprovado'],
    requiresOutput: false,
    color: '#06b6d4',
    description: 'Capítulo publicado e disponível para os leitores na plataforma.',
    isFinal: true
  }
];

// Helper to normalize position names for comparisons
export function normalizePositionName(name: string = ''): string {
  const n = name.trim().toLowerCase();
  if (n.includes('clean') || n.includes('redraw')) return 'clean_redraw';
  if (n.includes('raw')) return 'raw_provider';
  if (n.includes('trad')) return 'tradutor';
  if (n.includes('type')) return 'typer';
  if (n.includes('revis') || n.includes('qc') || n.includes('quality')) return 'revisor_qc';
  return n;
}

// Check if user can view a pipeline stage (ALL active members can view all 7 stages)
export function canViewStage(userScanRole?: string | null): boolean {
  return !!userScanRole;
}

// Check if user can claim a stage
export interface ClaimState {
  canClaim: boolean;
  isAdminOverride: boolean;
  buttonLabel: string;
  disabledReason?: string;
}

export function evaluateStageClaim(
  userScanRole: string | null | undefined,
  userPositions: Array<{ name?: string; slug?: string } | string> = [],
  stageSlug: string
): ClaimState {
  const stage = CANONICAL_PIPELINE_STAGES.find(s => s.slug === stageSlug);
  if (!stage) {
    return {
      canClaim: false,
      isAdminOverride: false,
      buttonLabel: 'Etapa Indisponível',
      disabledReason: 'Etapa não encontrada no pipeline.'
    };
  }

  // Published cannot be claimed
  if (stage.isFinal) {
    return {
      canClaim: false,
      isAdminOverride: false,
      buttonLabel: 'Publicado',
      disabledReason: 'Esta etapa representa o encerramento do pipeline.'
    };
  }

  // Pre Aprovado is for Dono or Gerente
  if (stage.adminOnly) {
    const isLeadership = userScanRole === 'OWNER' || userScanRole === 'ADMIN';
    return {
      canClaim: isLeadership,
      isAdminOverride: isLeadership,
      buttonLabel: isLeadership ? 'Aprovar Capítulo' : 'Aguardando Liderança',
      disabledReason: isLeadership ? undefined : 'Somente Dono ou Gerente pode aprovar esta etapa.'
    };
  }

  // Check if member has required editorial position
  const normalizedUserPos = userPositions.map(p => {
    if (typeof p === 'string') return normalizePositionName(p);
    return normalizePositionName(p.slug || p.name || '');
  });

  const reqSlug = stage.requiredRoleSlug || '';
  const hasEditorialRole = normalizedUserPos.includes(reqSlug);

  if (hasEditorialRole) {
    return {
      canClaim: true,
      isAdminOverride: false,
      buttonLabel: 'Pegar este capítulo'
    };
  }

  // Administrative bypass for Dono and Gerente
  const isLeadership = userScanRole === 'OWNER' || userScanRole === 'ADMIN';
  if (isLeadership) {
    return {
      canClaim: true,
      isAdminOverride: true,
      buttonLabel: 'Assumir (Intervenção Administrativa)'
    };
  }

  // Staff without the role: blocked with friendly label & tooltip
  return {
    canClaim: false,
    isAdminOverride: false,
    buttonLabel: `Disponível para ${stage.requiredRoleName}`,
    disabledReason: `Você não possui o cargo necessário para assumir a etapa ${stage.name}.`
  };
}

// Administrative authority checks
export function canManageMembers(callerRole?: string | null): boolean {
  return callerRole === 'OWNER' || callerRole === 'ADMIN';
}

export function canPromoteToManager(callerRole?: string | null): boolean {
  return callerRole === 'OWNER';
}

export function canDemoteManager(callerRole?: string | null): boolean {
  return callerRole === 'OWNER';
}

export function canRemoveMember(callerRole?: string | null, targetRole?: string | null): boolean {
  if (targetRole === 'OWNER') return false; // Owner cannot be removed
  if (callerRole === 'OWNER') return true;
  if (callerRole === 'ADMIN') {
    // Gerente can only remove Staff
    return targetRole === 'MEMBER';
  }
  return false;
}

export function canDeleteChapter(callerRole?: string | null): boolean {
  return callerRole === 'OWNER' || callerRole === 'ADMIN';
}

export function canUnpublishChapter(callerRole?: string | null): boolean {
  return callerRole === 'OWNER' || callerRole === 'ADMIN';
}
