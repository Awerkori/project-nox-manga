import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('profile editor draft regressions', () => {
  const editor = source('src/routes/me/+page.svelte');
  const action = source('src/routes/me/+page.server.ts');
  const avatarApi = source('src/routes/api/avatar/+server.ts');
  const bannerApi = source('src/routes/api/banner/+server.ts');
  const layout = source('src/routes/+layout.svelte');
  const publicProfile = source('src/routes/u/[username]/+page.svelte');

  it('keeps crop confirmation local and sends media only with Salvar Alterações', () => {
    expect(editor).not.toContain("const endpoint = cropType === 'avatar' ? '/api/avatar' : '/api/banner'");
    expect(editor).toContain("uploadNotice = `${cropType === 'avatar' ? 'Avatar' : 'Banner'} pronto para prévia.");
    expect(editor).toContain("formData.set('avatar_file', draftAvatar.file, draftAvatar.file.name)");
    expect(editor).toContain("formData.set('banner_file', draftBanner.file, draftBanner.file.name)");
  });

  it('can discard local media and form fields without changing canonical member data', () => {
    expect(editor).toContain('function cancelProfileChanges()');
    expect(editor).toContain('discardMediaDrafts();');
    expect(editor).toContain('URL.revokeObjectURL');
    expect(editor).toContain('Cancelar alterações');
  });

  it('uploads all pending media before its single canonical member update', () => {
    const avatarStore = action.indexOf("storeImage(upload, locals.user.id, 'avatar')");
    const bannerStore = action.indexOf("storeImage(upload, locals.user.id, 'banner')");
    const commit = action.indexOf(".from('members')", action.indexOf('const { data: updatedMember'));
    expect(avatarStore).toBeGreaterThan(-1);
    expect(bannerStore).toBeGreaterThan(avatarStore);
    expect(commit).toBeGreaterThan(bannerStore);
    expect(action).toContain('invalidateUserSession(locals.user.id);');
  });

  it('invalidates the header session cache for every canonical avatar/banner write', () => {
    expect(avatarApi).toContain('invalidateUserSession(userId);');
    expect(bannerApi).toContain('invalidateUserSession(userId);');
    expect(editor).toContain("new CustomEvent('nox:profile-updated'");
    expect(layout).toContain("window.addEventListener('nox:profile-updated', handleProfileUpdate);");
    expect(layout).toContain('let profile = $derived(profileOverride || data.profile);');
  });

  it('uses the same larger banner ratios in the editor and public profile', () => {
    expect(editor).toContain('aspect-ratio: 16 / 5;');
    expect(editor).toContain('aspect-ratio: 16 / 6;');
    expect(publicProfile).toContain('aspect-ratio: 16 / 5;');
    expect(publicProfile).toContain('aspect-ratio: 16 / 6;');
  });
});
