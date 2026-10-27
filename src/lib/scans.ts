export interface ScanPosition {
  id: string;
  scan_id: string;
  name: string;
  description: string;
  icon?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface ScanMemberPosition {
  id: string;
  scan_id: string;
  user_id: string;
  position_id: string;
  is_primary: boolean;
  created_at?: string;
  position?: ScanPosition;
}

export interface ScanRecruitmentOpening {
  id: string;
  scan_id: string;
  position_id: string;
  title: string;
  description: string;
  requirements: string;
  language: string;
  experience_level: string;
  availability: string;
  slots?: number | null;
  notes: string;
  status: "OPEN" | "PAUSED" | "CLOSED";
  created_at: string;
  updated_at?: string;
  position?: ScanPosition;
  scan?: {
    id: string;
    name: string;
    slug: string;
    logo_id?: string | null;
    is_official?: boolean;
    display_preposition?: string;
  };
}

export interface ScanApplication {
  id: string;
  scan_id: string;
  opening_id: string;
  position_id: string;
  user_id: string;
  experience: string;
  availability: string;
  presentation: string;
  portfolio_url?: string | null;
  contact_info: string;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  internal_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
  opening?: ScanRecruitmentOpening;
  position?: ScanPosition;
  user?: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_id?: string | null;
    xp?: number;
  };
}

export interface ScanActivity {
  id: string;
  scan_id: string;
  user_id?: string | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
  user?: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_id?: string | null;
  };
}

export function getScanPreposition(scan?: { display_preposition?: string; slug?: string; name?: string } | null): string {
  if (!scan) return "de";
  if (scan.display_preposition) return scan.display_preposition;
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

export interface ScanComment {
  id: string;
  scan_id: string;
  user_id: string;
  parent_id?: string | null;
  body: string;
  removed: boolean;
  pinned: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_id?: string | null;
    avatar_frame_id?: string | null;
    name_color?: string | null;
    xp?: number;
    equipped_badge_id?: string | null;
  };
  likes_count: number;
  user_liked?: boolean;
  replies?: ScanComment[];
}

export interface ScanStaffNote {
  id: string;
  scan_id: string;
  user_id: string;
  parent_id?: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_id?: string | null;
  };
  replies?: ScanStaffNote[];
}

export interface ScanCommentReport {
  id: string;
  comment_id: string;
  user_id: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  comment?: ScanComment;
  reporter?: {
    id: string;
    username: string;
    display_name?: string | null;
  };
}

export interface ScanPartnerRequestMeta {
  logo_id?: string | null;
  banner_id?: string | null;
  banner_crop_mode?: 'preserve_original' | 'custom_crop' | null;
  banner_crop_x?: number;
  banner_crop_y?: number;
  banner_crop_zoom?: number;
  extra_info?: string;
  message?: string;
  sample_links?: string;
}

export function parsePartnerRequestMeta(sampleLinksRaw: string | null | undefined): ScanPartnerRequestMeta {
  if (!sampleLinksRaw) {
    return {
      logo_id: null,
      banner_id: null,
      banner_crop_mode: 'preserve_original',
      banner_crop_x: 50,
      banner_crop_y: 50,
      banner_crop_zoom: 1,
      extra_info: '',
      message: '',
      sample_links: ''
    };
  }
  try {
    const parsed = JSON.parse(sampleLinksRaw);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        logo_id: parsed.logo_id || null,
        banner_id: parsed.banner_id || null,
        banner_crop_mode: parsed.banner_crop_mode || 'preserve_original',
        banner_crop_x: Number(parsed.banner_crop_x ?? 50),
        banner_crop_y: Number(parsed.banner_crop_y ?? 50),
        banner_crop_zoom: Number(parsed.banner_crop_zoom ?? 1),
        extra_info: parsed.extra_info || '',
        message: parsed.message || '',
        sample_links: parsed.sample_links || ''
      };
    }
  } catch {}
  return {
    logo_id: null,
    banner_id: null,
    banner_crop_mode: 'preserve_original',
    banner_crop_x: 50,
    banner_crop_y: 50,
    banner_crop_zoom: 1,
    extra_info: '',
    message: '',
    sample_links: sampleLinksRaw
  };
}
