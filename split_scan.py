import math

lines = open('src/routes/scan/+page.server.ts').readlines()
chunk_size = math.ceil(len(lines) / 4)

for i in range(4):
    start = i * chunk_size
    end = start + chunk_size
    with open(f'/tmp/scan_part_{i}.ts', 'w') as f:
        f.writelines(lines[start:end])
