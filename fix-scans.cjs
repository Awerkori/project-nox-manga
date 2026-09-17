const fs = require('fs');
let code = fs.readFileSync('src/routes/scans/[slug]/+page.server.ts', 'utf8');

code = code.replace(
  'export const actions: Actions = {',
  `import * as actionsApi from '$lib/server/scan-public-actions';\n\nexport const actions: Actions = {`
);

code = code.replace(
  /apply: async \({ request, locals }\) => {[\s\S]*?postComment: async/m,
  `apply: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: "Você precisa estar conectado para se candidatar." });
    const formData = await request.formData();
    const openingId = formData.get("opening_id") as string;
    const experience = (formData.get("experience") as string)?.trim() || "";
    const availability = (formData.get("availability") as string)?.trim() || "";
    const presentation = (formData.get("presentation") as string)?.trim() || "";
    const portfolioUrl = (formData.get("portfolio_url") as string)?.trim() || null;
    const contactInfo = (formData.get("contact_info") as string)?.trim() || "";
    if (!openingId) return fail(400, { message: "Vaga não especificada." });
    const { data, error: rpcErr } = await actionsApi.apply_for_scan_opening(openingId, experience, availability, presentation, portfolioUrl, contactInfo, locals.user.id);
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, applicationSent: true, data };
  },

  postComment: async`
);

code = code.replace(
  /postComment: async \({ request, locals, params }\) => {[\s\S]*?likeComment: async/m,
  `postComment: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: "Você precisa estar conectado para comentar." });
    const formData = await request.formData();
    const scanId = formData.get("scan_id") as string;
    const body = (formData.get("body") as string)?.trim() || "";
    const parentId = (formData.get("parent_id") as string) || null;
    if (!scanId || !body) return fail(400, { message: "Comentário não pode estar em branco." });
    const { data, error: rpcErr } = await actionsApi.post_scan_comment(scanId, body, parentId, locals.user.id);
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, commentPosted: true, data };
  },

  likeComment: async`
);

code = code.replace(
  /likeComment: async \({ request, locals }\) => {[\s\S]*?moderateComment: async/m,
  `likeComment: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: "Você precisa estar conectado para curtir." });
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    if (!commentId) return fail(400, { message: "Comentário não informado." });
    const { data, error: rpcErr } = await actionsApi.like_scan_comment(commentId, locals.user.id);
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, likeResult: data };
  },

  moderateComment: async`
);

code = code.replace(
  /moderateComment: async \({ request, locals }\) => {[\s\S]*?reportComment: async/m,
  `moderateComment: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: "Acesso negado." });
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const actionType = formData.get("action_type") as string;
    if (!commentId || !actionType) return fail(400, { message: "Dados insuficientes para moderação." });
    const { data, error: rpcErr } = await actionsApi.moderate_scan_comment(commentId, actionType, locals.user.id);
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, moderateResult: data };
  },

  reportComment: async`
);

code = code.replace(
  /reportComment: async \({ request, locals }\) => {[\s\S]*?}\s*};/m,
  `reportComment: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: "Você precisa estar conectado para denunciar." });
    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const reason = (formData.get("reason") as string)?.trim() || "";
    if (!commentId || !reason || reason.length < 2) return fail(400, { message: "Informe um motivo de denúncia válido." });
    const { data, error: rpcErr } = await actionsApi.report_scan_comment(commentId, reason, locals.user.id);
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, reportSent: true, data };
  }
};`
);

fs.writeFileSync('src/routes/scans/[slug]/+page.server.ts', code);
