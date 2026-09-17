import re

with open('src/routes/u/[username]/+page.server.ts', 'r') as f:
    content = f.read()

def replace_all(content, old, new):
    if old not in content:
        print("NOT FOUND:", old[:50])
    return content.replace(old, new)

# toggleScanPrivacy
t_old = """    const { error: rpcErr } = await locals.db.rpc('toggle_user_scan_privacy', {
      p_show_scans: showScans,
      p_mode: mode
    });"""
t_new = """    const { error: rpcErr } = await safeQuerySingle(
      db.execute(sql`SELECT toggle_user_scan_privacy(${showScans}, ${mode})`)
    );"""
content = replace_all(content, t_old, t_new)

# moderateUserScans
m_old = """    const { error: rpcErr } = await locals.db.rpc('admin_moderate_user_scans', {
      p_target_user_id: targetUserId,
      p_hide_badges: hideBadges
    });"""
m_new = """    const { error: rpcErr } = await safeQuerySingle(
      db.execute(sql`SELECT admin_moderate_user_scans(${targetUserId}, ${hideBadges})`)
    );"""
content = replace_all(content, m_old, m_new)

with open('src/routes/u/[username]/+page.server.ts', 'w') as f:
    f.write(content)
