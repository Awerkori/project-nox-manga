import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { safeQuery, safeQuerySingle } from '$lib/server/db/safe';

export interface CachedSession {
  user: any;
  role: string | null;
  profile: any;
  userScans: any[];
  unread: number;
  cachedAt: number;
  tokenExp: number;
}

const sessionCache = new Map<string, CachedSession>();
const activeFlights = new Map<string, Promise<CachedSession>>();
const SESSION_CACHE_TTL_MS = 60 * 1000;

export async function resolveSessionData(
  sessionObject: any
): Promise<CachedSession> {
  const cacheKey = sessionObject.id;
  const now = Date.now();

  const cached = sessionCache.get(cacheKey);
  if (cached && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return cached;
  }

  const existingFlight = activeFlights.get(cacheKey);
  if (existingFlight) {
    return existingFlight;
  }

  const flightPromise = (async () => {
    try {
      const userId = sessionObject.user.id;

      // Drizzle fetches
      const profileRes = await safeQuerySingle(
        db.select().from(schema.members).where(eq(schema.members.id, userId))
      );
      const roleRes = await safeQuerySingle(
        db.select().from(schema.accessRoles).where(eq(schema.accessRoles.userId, userId))
      );
      
      const userScansRes = await safeQuery(
        db.select({
          role: schema.scanMembers.role,
          scanId: schema.scanMembers.scanId,
          scan: {
            id: schema.scans.id,
            name: schema.scans.name,
            slug: schema.scans.slug,
            logoId: schema.scans.logoId,
            status: schema.scans.status
          }
        })
        .from(schema.scanMembers)
        .leftJoin(schema.scans, eq(schema.scanMembers.scanId, schema.scans.id))
        .where(eq(schema.scanMembers.userId, userId))
      );

      const ownedScansRes = await safeQuery(
        db.select()
        .from(schema.scans)
        .where(and(eq(schema.scans.ownerId, userId), eq(schema.scans.status, 'ACTIVE')))
      );

      // We do not have count aggregation easily yet without building the exact SQL, just getting all unread ids
      const unreadRes = await safeQuery(
        db.select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
      );

      let effectiveRole = null;
      if (roleRes?.data && !roleRes.data.suspended) {
        effectiveRole = roleRes.data.role;
      }

      const isPlatformOwner = Boolean(userId && (userId === (process.env.STAFF_OWNER_USER_ID || '732fbe87-5040-41fb-9983-0aedb2af44c8')));
      if (!effectiveRole && isPlatformOwner) {
        effectiveRole = 'ADMIN';
      }

      const scansMap = new Map<string, any>();

      if (ownedScansRes.data) {
        for (const s of ownedScansRes.data) {
          scansMap.set(s.id, {
            id: s.id,
            name: s.name,
            slug: s.slug,
            logo_id: s.logoId,
            status: s.status,
            role: 'OWNER'
          });
        }
      }

      if (userScansRes.data) {
        for (const m of userScansRes.data) {
          if (m.scan) {
            const existing = scansMap.get(m.scan.id);
            const finalRole = existing?.role === 'OWNER' ? 'OWNER' : m.role;
            scansMap.set(m.scan.id, {
              id: m.scan.id,
              name: m.scan.name,
              slug: m.scan.slug,
              logo_id: m.scan.logoId,
              status: m.scan.status,
              role: finalRole
            });
          }
        }
      }

      if (scansMap.size === 0 && isPlatformOwner) {
        scansMap.set('04872e99-37ad-4d45-aed4-35759d0eae33', {
          id: '04872e99-37ad-4d45-aed4-35759d0eae33',
          name: 'Project Nox',
          slug: 'project-nox',
          logo_id: null,
          status: 'ACTIVE',
          role: 'OWNER'
        });
      }

      const consolidatedUserScans = Array.from(scansMap.values());

      const profile = profileRes.data || {
        id: userId,
        display_name: sessionObject.user.name || 'Leitor',
        username: sessionObject.user.email ? sessionObject.user.email.split('@')[0] : 'leitor',
        avatar_id: null,
        avatar_frame_id: null,
        role: effectiveRole || 'LEITOR'
      };

      const result: CachedSession = {
        user: sessionObject.user,
        role: effectiveRole,
        profile,
        userScans: consolidatedUserScans,
        unread: unreadRes.data ? unreadRes.data.length : 0,
        cachedAt: now,
        tokenExp: sessionObject.session.expiresAt.getTime() / 1000
      };

      sessionCache.set(cacheKey, result);

      if (sessionCache.size > 500) {
        const earliest = now - SESSION_CACHE_TTL_MS;
        for (const [k, v] of sessionCache.entries()) {
          if (v.cachedAt < earliest) sessionCache.delete(k);
        }
      }

      return result;
    } catch (error) {
      const userId = sessionObject.user.id;
      return {
        user: sessionObject.user,
        role: null,
        profile: {
          id: userId,
          display_name: sessionObject.user.name || 'Leitor',
          username: sessionObject.user.email ? sessionObject.user.email.split('@')[0] : 'leitor',
          role: 'LEITOR'
        },
        userScans: [],
        unread: 0,
        cachedAt: now,
        tokenExp: sessionObject.session.expiresAt.getTime() / 1000
      };
    } finally {
      activeFlights.delete(cacheKey);
    }
  })();

  activeFlights.set(cacheKey, flightPromise);
  return flightPromise;
}

export function invalidateUserSession(userId: string) {
  for (const [k, session] of sessionCache.entries()) {
    if (session.user.id === userId) {
      sessionCache.delete(k);
    }
  }
}
