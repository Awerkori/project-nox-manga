export type Work = {
  id: string;
  slug: string;
  title: string;
  aliases: string[];
  synopsis: string;
  description: string;
  author: string;
  artist: string;
  kind: string;
  status: string;
  year: number | null;
  age_rating: number;
  published: boolean;
  featured: boolean;
  cover_id: string | null;
  updated_at: string;
  created_at: string;
};
export const statusLabels: Record<string, string> = {
  ONGOING: 'Em andamento',
  COMPLETED: 'Concluído',
  HIATUS: 'Em pausa',
  CANCELLED: 'Cancelado',
  READING: 'Lendo',
  PLANNED: 'Quero ler'
};
export const kindLabels: Record<string, string> = {
  MANGA: 'Mangá',
  MANHWA: 'Manhwa',
  MANHUA: 'Manhua',
  WEBTOON: 'Webtoon'
};
export const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value)
  );

export function relativeTime(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return 'agora há pouco';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return date(value);
}
export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function memberRank(xp: number): { level: number; title: string; badge: string } {
  const level = Math.floor(Math.max(0, xp) / 250) + 1;
  if (level >= 10) return { level, title: 'Soberano Nox', badge: '✦✦✦' };
  if (level >= 5) return { level, title: 'Guardião das Sombras', badge: '✦✦' };
  if (level >= 3) return { level, title: 'Explorador da Noite', badge: '✦' };
  if (level >= 2) return { level, title: 'Desbravador', badge: '◈' };
  return { level, title: 'Iniciado Nox', badge: '·' };
}

