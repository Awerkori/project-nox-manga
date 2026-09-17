import re
with open('src/routes/media/[id]/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("""import { extractFullAuthCookie, decodeSessionJwt, resolveSessionData } from '$lib/server/session-cache';

export const GET = async ({ params, request, platform, cookies }: any) => {""", """export const GET = async ({ params, request, platform, locals }: any) => {""")

content = content.replace("""    let verifiedSession = null;
    const raw = extractFullAuthCookie(cookies.getAll());
    if (raw) {
      const { jwt } = decodeSessionJwt(raw);
      if (jwt) {
        try { verifiedSession = await resolveSessionData(jwt); } catch {}
      }
    }
    const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(verifiedSession?.role || '');
    const isOwner = Boolean(verifiedSession?.user?.id && media.createdBy === verifiedSession.user.id);
    const isAuthenticatedAllowed = media.accessClass === 'AUTHENTICATED' && Boolean(verifiedSession?.user?.id);""", """    const verifiedSession = locals;
    const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(verifiedSession?.role || '');
    const isOwner = Boolean(verifiedSession?.user?.id && media.createdBy === verifiedSession.user.id);
    const isAuthenticatedAllowed = media.accessClass === 'AUTHENTICATED' && Boolean(verifiedSession?.user?.id);""")

with open('src/routes/media/[id]/+server.ts', 'w') as f:
    f.write(content)
