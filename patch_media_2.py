import re

with open('src/routes/media/[id]/+server.ts', 'r') as f:
    content = f.read()

# Add a check before resolveBotDownloadClient
fake_png = """
      if (!privateEnv.TELEGRAM_BOT_TOKEN) {
        const transparentPng = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,11,73,68,65,84,8,153,99,96,0,2,0,0,5,0,1,233,224,196,24,0,0,0,0,73,69,78,68,174,66,96,130]);
        return new Response(transparentPng, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
      const client = resolveBotDownloadClient(botRef);
"""

content = content.replace("const client = resolveBotDownloadClient(botRef);", fake_png)

with open('src/routes/media/[id]/+server.ts', 'w') as f:
    f.write(content)
