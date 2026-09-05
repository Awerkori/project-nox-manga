import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.svelte') ? [`${dir}/${e.name}`] : []
  );
}
for (const path of walk('src')) {
  let source = readFileSync(path, 'utf8');
  source = source.replace(/\{#each ([^}]+?) as (\w+)(?:,\s*(\w+))?\}/g, (match, expression, name, index) => {
    let key;
    if (name === 'value') key = name;
    else if (name === 'setting') key = 'setting.key';
    else if (name === 'item')
      key = expression.includes('recent')
        ? 'item.chapters.id'
        : expression.includes('history')
          ? 'item.chapter_id'
          : expression.includes('library')
            ? 'item.work_id'
            : 'item.id';
    else if (name === 'page') key = path.includes('admin/') ? 'page.id' : 'page.position';
    else if (name === 'tag') key = 'tag?.id';
    else key = `${name}.id`;
    return `{#each ${expression} as ${name}${index ? ',' + index : ''} (${key})}`;
  });
  source = source
    .replace(/as \[value,label\]\}/g, 'as [value,label] (value)}')
    .replace(/as \[path,label\]\}/g, 'as [path,label] (path)}');
  if (path.includes('admin/obras/') && source.includes('$state(data.')) {
    source = source.replace('<script lang="ts">', '<script lang="ts">\n import {untrack} from \'svelte\';');
    source = source.replace('let {data}=$props();', 'let {data}=$props();const initial=untrack(()=>data);');
    source = source
      .replaceAll('$state(data.', '$state(initial.')
      .replaceAll('$state<string[]>(data.', '$state<string[]>(initial.');
  }
  writeFileSync(path, source);
}
