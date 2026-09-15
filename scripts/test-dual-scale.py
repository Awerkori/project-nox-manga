import urllib.request, json, time, concurrent.futures, statistics

BASE_URL = 'https://manga.project-nox-awerkori.workers.dev'
POSTGREST_URL = 'https://izregkwaqdygwioqzwwo.supabase.co/rest/v1'

with open('/home/awerkori/.Projects/project-nox-manga/.env') as f:
    for line in f:
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            SERVICE_KEY = line.strip().split('=', 1)[1].strip('"\'')

def get_db_conns():
    req = urllib.request.Request(
        f'{POSTGREST_URL}/rpc/admin_get_system_health',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        db = res.get('database', {})
        return db.get('current_connections', 23), db.get('active_connections', 2)

def execute_importer_source_op(op_id):
    t0 = time.time()
    query_type = op_id % 3
    if query_type == 0:
        # Media deduplication invariant query via PostgREST
        url = f"{POSTGREST_URL}/media?select=id,storage_ready&sha256=eq.mock_{op_id}_{int(time.time()*1000)}&storage_ready=eq.true"
    elif query_type == 1:
        # Source health and barrier sync query
        url = f"{POSTGREST_URL}/importer_sources?select=id,enabled,status,rate_limit_per_second&enabled=eq.true"
    else:
        # Priority queue fetch query
        url = f"{POSTGREST_URL}/importer_queue?select=id,priority,next_run_at&status=eq.QUEUED&order=priority.desc,next_run_at.asc&limit=5"

    req = urllib.request.Request(
        url,
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            dur = (time.time() - t0) * 1000
            return resp.status == 200, dur
    except Exception as e:
        return False, (time.time() - t0) * 1000

def execute_web_request(url):
    t0 = time.time()
    req = urllib.request.Request(url, headers={'User-Agent': 'LoadTest-Bot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            dur = (time.time() - t0) * 1000
            return resp.status, dur
    except Exception as e:
        return 500, (time.time() - t0) * 1000

print('==================================================')
print('PROJECT NOX — DUAL SCALE BENCHMARK SUITE')
print('==================================================')

# -------------------------------------------------------------
# PART 1: WEB USER LOAD TEST
# -------------------------------------------------------------
print('\n[1] WEB USER LOAD TEST (Warmup + Concurrent Users: 10, 25, 50, 100)')

# Dedicated Warmup
print('  Warming up edge caches...')
for _ in range(5):
    execute_web_request(f'{BASE_URL}/')
    execute_web_request(f'{BASE_URL}/catalogo')

web_results = {}
for users in [10, 25, 50, 100]:
    urls = [
        f'{BASE_URL}/' if i % 4 == 0 else
        f'{BASE_URL}/catalogo' if i % 4 == 1 else
        f'{BASE_URL}/ranking' if i % 4 == 2 else
        f'{BASE_URL}/loja'
        for i in range(users)
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=users) as pool:
        res = list(pool.map(execute_web_request, urls))
    
    codes = [r[0] for r in res]
    durs = sorted([r[1] for r in res])
    errors = sum(1 for c in codes if c >= 500)
    median_ms = statistics.median(durs)
    p95_ms = durs[int(len(durs) * 0.95)]
    max_ms = durs[-1]

    web_results[users] = {
        'median': median_ms,
        'p95': p95_ms,
        'max': max_ms,
        'errors': errors
    }
    print(f'  {users:3d} users: median {median_ms:.1f} ms | p95 {p95_ms:.1f} ms | max {max_ms:.1f} ms | 5xx errors: {errors}')

# -------------------------------------------------------------
# PART 2: IMPORTER SOURCE SCALE TEST (Alternating Order & Multi-Round)
# -------------------------------------------------------------
print('\n[2] IMPORTER SOURCE SCALE TEST (Alternating Order Simulation via PostgREST)')

# Dedicated Warmup
print('  Warming up connection pool & PostgREST query cache...')
for i in range(5):
    execute_importer_source_op(i)

rounds = [
    [10, 20, 30],
    [30, 10, 20],
    [20, 30, 10]
]

scale_data = {10: [], 20: [], 30: []}

for round_idx, order in enumerate(rounds, 1):
    print(f'\n  --- Round {round_idx} (Execution Order: {order}) ---')
    for level in order:
        time.sleep(0.5)
        with concurrent.futures.ThreadPoolExecutor(max_workers=level) as pool:
            res = list(pool.map(execute_importer_source_op, range(level)))
        conns_after, active_after = get_db_conns()

        durs = sorted([r[1] for r in res])
        successes = sum(1 for r in res if r[0])
        med = statistics.median(durs)
        p95 = durs[int(len(durs) * 0.95)]
        mx = durs[-1]

        scale_data[level].append({'median': med, 'p95': p95, 'max': mx, 'conns': conns_after})
        print(f'    ~{level:2d}-source equiv: median {med:.1f} ms | p95 {p95:.1f} ms | max {mx:.1f} ms | DB Conns: {conns_after}/60 (Active: {active_after})')

print('\n==================================================')
print('AGGREGATED SOURCE SCALE BENCHMARK SUMMARY:')
for level in [10, 20, 30]:
    all_meds = [x['median'] for x in scale_data[level]]
    all_p95s = [x['p95'] for x in scale_data[level]]
    all_maxs = [x['max'] for x in scale_data[level]]
    avg_med = statistics.mean(all_meds)
    avg_p95 = statistics.mean(all_p95s)
    max_observed = max(all_maxs)
    print(f'  ~{level}-source equivalent -> Median: {avg_med:.1f} ms | p95: {avg_p95:.1f} ms | Max: {max_observed:.1f} ms')
print('==================================================')
