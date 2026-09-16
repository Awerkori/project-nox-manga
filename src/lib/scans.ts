export interface ScanPosition {id: string;
  scanId: string;
  name: string;
  description: string;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;}

export interface ScanMemberPosition {id: string;
  scanId: string;
  userId: string;
  positionId: string;
  isPrimary: boolean;
  createdAt?: string;
  position?: ScanPosition;}

export interface ScanRecruitmentOpening {id: string;
  scanId: string;
  positionId: string;
  title: string;
  description: string;
  requirements: string;
  language: string;
  experienceLevel: string;
  availability: string;
  slots?: number | null;
  notes: string;
  status: "OPEN" | "PAUSED" | "CLOSED";
  createdAt: string;
  updatedAt?: string;
  position?: ScanPosition;
  scan?: {
    id: string;
    name: string;
    slug: string;
    logoId?: string | null;
    isOfficial?: boolean;
    displayPreposition?: string;};
}

export interface ScanApplication {id: string;
  scanId: string;
  openingId: string;
  positionId: string;
  userId: string;
  experience: string;
  availability: string;
  presentation: string;
  portfolioUrl?: string | null;
  contactInfo: string;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  internalNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  opening?: ScanRecruitmentOpening;
  position?: ScanPosition;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarId?: string | null;
    xp?: number;};
}

export interface ScanActivity {id: string;
  scanId: string;
  userId?: string | null;
  action: string;
  details: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarId?: string | null;};
}

export function getScanPreposition(scan?: {displayPreposition?: string; slug?: string; name?: string} | null): string {
  if (!scan) return "de";
  if (scan.displayPreposition) return scan.displayPreposition;
  if (scan.slug === "project-nox") return "do";
  const lower = (scan.name || "").toLowerCase();
  if (lower.includes("scan") || lower.includes("toons") || lower.includes("equipe")) {
    return "da";
  }
  return "de";
}

export function formatScanRoleTitle(
  role: string | null | undefined,
  positionName: string | null | undefined,
  scanName: string,
  preposition: string = "de"
): string {
  const prep = preposition === "da" ? "da" : preposition === "do" ? "do" : "de";
  if (role === "OWNER") {
    return `Dono ${prep} ${scanName}`;
  }
  if (positionName && positionName.trim()) {
    return `${positionName.trim()} ${prep} ${scanName}`;
  }
  if (role === "ADMIN") {
    return `Administrador ${prep} ${scanName}`;
  }
  if (role === "UPLOADER") {
    return `Uploader ${prep} ${scanName}`;
  }
  return `Membro ${prep} ${scanName}`;
}

export function formatScanBadgeText(
  role: string | null | undefined,
  positionName: string | null | undefined,
  scanName: string
): string {
  if (role === "OWNER") {
    return `👑 Dono · ${scanName}`;
  }
  if (positionName && positionName.trim()) {
    return `${positionName.trim()} · ${scanName}`;
  }
  if (role === "ADMIN") {
    return `Admin · ${scanName}`;
  }
  return `${role === "UPLOADER" ? "Uploader" : "Staff"} · ${scanName}`;
}

export interface ScanComment {id: string;
  scanId: string;
  userId: string;
  parentId?: string | null;
  body: string;
  removed: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarId?: string | null;
    avatarFrameId?: string | null;
    nameColor?: string | null;
    xp?: number;
    equippedBadgeId?: string | null;};
  likes_count: number;
  user_liked?: boolean;
  replies?: ScanComment[];
}

export interface ScanStaffNote {id: string;
  scanId: string;
  userId: string;
  parentId?: string | null;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarId?: string | null;};
  replies?: ScanStaffNote[];
}

export interface ScanCommentReport {id: string;
  commentId: string;
  userId: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  comment?: ScanComment;
  reporter?: {
    id: string;
    username: string;
    displayName?: string | null;};
}
