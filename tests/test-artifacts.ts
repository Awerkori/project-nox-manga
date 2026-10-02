import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.env.NOX_TEST_ARTIFACT_DIR || 'test-results', 'screenshots');

export function testArtifactDir(...segments: string[]) {
  const directory = join(root, ...segments);
  mkdirSync(directory, { recursive: true });
  return directory;
}
