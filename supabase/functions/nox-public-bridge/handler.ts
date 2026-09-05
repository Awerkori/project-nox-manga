type Access = { role: string | null; caller: any };
type Dependencies = { authorize: (token: string) => Promise<Access | null>; source: () => any };
class BridgeError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
const requireData = (result: any) => {
  if (result.error) throw new BridgeError(502, 'Não foi possível consultar a central.');
  return result.data;
};
export function createBridge({ authorize, source }: Dependencies) {
  return async (request: Request) => {
    const reply = (data: unknown, status = 200) =>
      Response.json(data, {
        status,
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
      });
    try {
      if (request.method !== 'POST') return reply({ message: 'Método não permitido' }, 405);
      const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!token || token.length > 8192) return reply({ message: 'Autenticação necessária' }, 401);
      const access = await authorize(token);
      if (!access || !['ADMIN', 'EDITOR'].includes(access.role || ''))
        return reply({ message: 'Acesso negado' }, 403);
      const reader = request.body?.getReader();
      if (!reader) return reply({ message: 'Solicitação inválida' }, 400);
      let body = '',
        size = 0;
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          return reply({ message: 'Solicitação acima do limite' }, 413);
        }
        body += decoder.decode(value, { stream: true });
      }
      let input;
      try {
        input = JSON.parse(body + decoder.decode());
      } catch {
        return reply({ message: 'Solicitação inválida' }, 400);
      }
      if (!input || typeof input !== 'object') return reply({ message: 'Solicitação inválida' }, 400);
      const { action, id } = input;
      if (!['works', 'chapters', 'final', 'members', 'authorize_staff'].includes(action))
        return reply({ message: 'Operação não permitida' }, 400);
      if (['members', 'authorize_staff'].includes(action) && access.role !== 'ADMIN')
        return reply({ message: 'Somente administradores' }, 403);
      if (
        ['chapters', 'final', 'authorize_staff'].includes(action) &&
        (typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      )
        return reply({ message: 'Identificador inválido' }, 400);
      const db = source();
      if (action === 'works')
        return reply({
          works:
            requireData(await db.from('works').select('id,title,aliases,synopsis,status').limit(1000)) || []
        });
      if (action === 'members')
        return reply({
          members:
            requireData(
              await db
                .from('staff_members')
                .select('user_id,display_name,github_login')
                .eq('is_active', true)
                .order('display_name')
                .limit(200)
            ) || []
        });
      if (action === 'authorize_staff') {
        const staff = requireData(
          await db
            .from('staff_members')
            .select('user_id')
            .eq('user_id', id)
            .eq('is_active', true)
            .maybeSingle()
        );
        if (!staff) return reply({ message: 'Este membro não está ativo na central.' }, 404);
        const {
          data: { user },
          error
        } = await db.auth.admin.getUserById(staff.user_id);
        if (error || !user?.email || !user.email_confirmed_at)
          return reply({ message: 'A conta da central precisa ter um e-mail confirmado.' }, 409);
        // Only the public site's invitation RPC is writable, under its owner's verified JWT.
        const result = await access.caller.rpc('invite_editor', { p_email: user.email });
        if (result.error)
          return reply({ message: 'Não foi possível registrar a autorização editorial.' }, 400);
        return reply({
          message:
            'Acesso editorial autorizado. O membro deve entrar no site com o mesmo e-mail confirmado da central. Nenhuma permissão da central foi alterada.'
        });
      }
      if (action === 'chapters') {
        const chapters = requireData(
          await db
            .from('chapters')
            .select('id,number,title,chapter_stages!inner(stage,status)')
            .eq('work_id', id)
            .eq('chapter_stages.stage', 'READY')
            .eq('chapter_stages.status', 'COMPLETED')
            .limit(200)
        );
        return reply({
          chapters: (chapters || []).map((c: any) => ({ id: c.id, number: c.number, title: c.title }))
        });
      }
      const ready = requireData(
        await db
          .from('chapter_stages')
          .select('chapter_id')
          .eq('chapter_id', id)
          .eq('stage', 'READY')
          .eq('status', 'COMPLETED')
          .maybeSingle()
      );
      if (!ready)
        return reply(
          { message: 'Somente capítulos finais aprovados pela revisão podem ser importados.' },
          403
        );
      const chapter = requireData(
        await db.from('chapters').select('number,title').eq('id', id).maybeSingle()
      );
      const files = requireData(
        await db
          .from('artifacts')
          .select('provider,provider_key,original_name,byte_size')
          .eq('chapter_id', id)
          .in('stage', ['TYPESET', 'REVIEW'])
          .order('created_at', { ascending: false })
          .limit(1)
      );
      const file = files?.[0];
      if (!chapter || !file || file.provider !== 'supabase')
        return reply({ message: 'Arquivo final ainda indisponível.' }, 404);
      if (file.byte_size > 300_000_000)
        return reply({ message: 'O arquivo final deve ter até 300 MB.' }, 413);
      const link = requireData(
        await db.storage.from('scan-artifacts').createSignedUrl(file.provider_key, 120)
      );
      if (!link) throw new BridgeError(502, 'Não foi possível abrir o arquivo final.');
      return reply({
        url: link.signedUrl,
        name: file.original_name,
        number: chapter.number,
        title: chapter.title
      });
    } catch (error) {
      return reply(
        {
          message: error instanceof BridgeError ? error.message : 'Integração temporariamente indisponível.'
        },
        error instanceof BridgeError ? error.status : 502
      );
    }
  };
}
