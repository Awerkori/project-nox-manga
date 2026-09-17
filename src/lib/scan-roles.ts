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
    description: 'Dono e fundador da Scan. Cargo nico, no atribuvel por gerenciador.',
    isAssignableByManager: false
  },
  ADMIN: {
    role: 'ADMIN',
    label: 'Gerente',
    icon: '🛡️',
    description: 'Funo administrativa. Gerencia equipe, tarefas e produo.',
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

export interface ScanEditorialRoleConfig {slug: string;
  name: string;
  icon: string;
  description: string;
  displayOrder: number;
  stageSlug: string;
  stageName: string;}

export const CANONICAL_EDITORIAL_ROLES: ScanEditorialRoleConfig[] = [
  {slug: 'raw_provider',
    name: 'Raw Provider',
    icon: '📦',
    description: 'Obteno e tratamento dos arquivos brutos em alta resoluo.',
    displayOrder: 1,
    stageSlug: 'raw',
    stageName: 'Raw Provider'},
  {slug: 'tradutor',
    name: 'Tradutor',
    icon: '🌐',
    description: 'Traduo e localizao fiel dos dilogos e narrativas.',
    displayOrder: 2,
    stageSlug: 'traducao',
    stageName: 'Traduo'},
  {slug: 'clean_redraw',
    name: 'Clean/Redraw',
    icon: '🎨',
    description: 'Limpeza dos bales e reconstruo artstica de fundos.',
    displayOrder: 3,
    stageSlug: 'clean_redraw',
    stageName: 'Clean/Redraw'},
  {slug: 'typer',
    name: 'Typer',
    icon: '✒️',
    description: 'Diagramao tipogrfica e formatao de falas e efeitos sonoros.',
    displayOrder: 4,
    stageSlug: 'typeset',
    stageName: 'Typeset'},
  {slug: 'revisor_qc',
    name: 'Revisor (QC)',
    icon: '🔎',
    description: 'Reviso gramatical, coeso editorial e controle de qualidade.',
    displayOrder: 5,
    stageSlug: 'revisor_qc',
    stageName: 'Revisor (QC)'}
];

export interface PipelineStageConfig {slug: string;
  name: string;
  icon: string;
  displayOrder: number;
  requiredRoleName: string | null;
  requiredRoleSlug: string | null;
  dependencies: string[];
  requiresOutput: boolean;
  color: string;
  description: string;
  adminOnly?: boolean;
  isFinal?: boolean;}

export const CANONICAL_PIPELINE_STAGES: PipelineStageConfig[] = [
  {slug: 'raw',
    name: 'Raw Provider',
    icon: '📦',
    displayOrder: 1,
    requiredRoleName: 'Raw Provider',
    requiredRoleSlug: 'raw_provider',
    dependencies: [],
    requiresOutput: true,
    color: '#64748b',
    description: 'Upload dos arquivos brutos e preparao das pginas para o pipeline.'},
  {slug: 'traducao',
    name: 'Traduo',
    icon: '🌐',
    displayOrder: 2,
    requiredRoleName: 'Tradutor',
    requiredRoleSlug: 'tradutor',
    dependencies: ['raw'],
    requiresOutput: true,
    color: '#3b82f6',
    description: 'Traduo do texto original preservando termos do glossrio.'},
  {slug: 'clean_redraw',
    name: 'Clean/Redraw',
    icon: '🎨',
    displayOrder: 3,
    requiredRoleName: 'Clean/Redraw',
    requiredRoleSlug: 'clean_redraw',
    dependencies: ['raw'],
    requiresOutput: true,
    color: '#ec4899',
    description: 'Limpeza dos bales e reconstruo artstica dos fundos.'},
  {slug: 'typeset',
    name: 'Typeset',
    icon: '✒️',
    displayOrder: 4,
    requiredRoleName: 'Typer',
    requiredRoleSlug: 'typer',
    dependencies: ['traducao', 'clean_redraw'],
    requiresOutput: true,
    color: '#eab308',
    description: 'Insero tipogrfica da traduo sobre as pginas limpas.'},
  {slug: 'revisor_qc',
    name: 'Revisor (QC)',
    icon: '🔎',
    displayOrder: 5,
    requiredRoleName: 'Revisor (QC)',
    requiredRoleSlug: 'revisor_qc',
    dependencies: ['typeset'],
    requiresOutput: false,
    color: '#a855f7',
    description: 'Inspeo de qualidade e reviso minuciosa antes da aprovao.'},
  {slug: 'pre_aprovado',
    name: 'Pr Aprovado',
    icon: '✅',
    displayOrder: 6,
    requiredRoleName: null,
    requiredRoleSlug: null,
    dependencies: ['revisor_qc'],
    requiresOutput: false,
    color: '#10b981',
    description: 'Captulo revisado aguardando autorizao da liderana para publicao.',
    adminOnly: true},
  {slug: 'publicado',
    name: 'Publicado',
    icon: '📚',
    displayOrder: 7,
    requiredRoleName: null,
    requiredRoleSlug: null,
    dependencies: ['pre_aprovado'],
    requiresOutput: false,
    color: '#06b6d4',
    description: 'Captulo publicado e disponvel para os leitores na plataforma.',
    isFinal: true}
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
      buttonLabel: 'Etapa Indisponvel',
      disabledReason: 'Etapa no encontrada no pipeline.'
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
      buttonLabel: isLeadership ? 'Aprovar Captulo' : 'Aguardando Liderana',
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
      buttonLabel: 'Pegar este captulo'
    };
  }

  // Administrative bypass for Dono and Gerente
  const isLeadership = userScanRole === 'OWNER' || userScanRole === 'ADMIN';
  if (isLeadership) {
    return {
      canClaim: true,
      isAdminOverride: true,
      buttonLabel: 'Assumir (Interveno Administrativa)'
    };
  }

  // Staff without the role: blocked with friendly label & tooltip
  return {
    canClaim: false,
    isAdminOverride: false,
    buttonLabel: `Disponvel para ${stage.requiredRoleName}`,
    disabledReason: `Voc no possui o cargo necessrio para assumir a etapa ${stage.name}.`
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
