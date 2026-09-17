with open('src/lib/server/db/safe.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "export async function safeQuery<T>(promise: Promise<T>) {",
    "export async function safeQuery<T>(promise: Promise<T>): Promise<{ data: T | null; error: any }> {"
)
content = content.replace(
    "export async function safeQuerySingle<T>(promise: Promise<T[]>) {",
    "export async function safeQuerySingle<T>(promise: Promise<T[]>): Promise<{ data: T | null; error: any }> {"
)

with open('src/lib/server/db/safe.ts', 'w') as f:
    f.write(content)
