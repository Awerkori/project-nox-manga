import re
with open('src/routes/api/staff/+server.ts', 'r') as f:
    content = f.read()

content = content.replace("""        title: work.title,
        aliases: work.aliases,
        synopsis: work.synopsis,
        slug: collision ? `${slug}-${work.id.slice(0, 8)}` : slug,
        sourceId: work.id,
        status: work.status === 'COMPLETED' ? 'COMPLETED' : work.status === 'PAUSED' ? 'HIATUS' : 'ONGOING',
        published: false""", """        title: work.title,
        aliases: work.aliases || [],
        synopsis: work.synopsis || '',
        slug: collision ? `${slug}-${work.id.slice(0, 8)}` : slug,
        sourceId: work.id,
        status: work.status === 'COMPLETED' ? 'COMPLETED' : work.status === 'PAUSED' ? 'HIATUS' : 'ONGOING',
        published: false,
        author: '',
        artist: '',
        description: '',
        kind: 'MANHWA',
        contentRating: 'SAFE',
        viewsTotal: 0,
        ageRating: 0,
        featured: false,
        searchText: '',
        metadataProvenance: 'MIHON'""")

with open('src/routes/api/staff/+server.ts', 'w') as f:
    f.write(content)
