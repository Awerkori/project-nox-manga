import pg from 'pg';
import fs from 'node:fs';

const envLines = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf8').split('\n');
const envVars = {};
for (const l of envLines) {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ca = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf8');
const pool = new pg.Pool({
  host: envVars.YUGABYTE_HOST,
  port: parseInt(envVars.YUGABYTE_PORT || '5433', 10),
  user: envVars.YUGABYTE_USER,
  password: envVars.YUGABYTE_PASSWORD,
  database: envVars.YUGABYTE_DATABASE,
  ssl: { ca, rejectUnauthorized: false }
});

const sql = `
CREATE OR REPLACE FUNCTION public.process_expired_scan_stages_ysql(p_scan_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_devolved_count integer := 0;
  v_availability_version integer;
  v_devolved_ids uuid[] := '{}';
BEGIN
  FOR r IN
    SELECT 
      cs.id as stage_id,
      cs.scan_id,
      cs.assigned_to,
      cs.due_at,
      cs.extension_count,
      cs.availability_version,
      cs.production_chapter_id,
      cs.chapter_id,
      ws.id as workflow_stage_id,
      ws.name as stage_name,
      ws.slug as stage_slug,
      pc.chapter_number,
      w.title as work_title
    FROM public.scan_chapter_stages cs
    JOIN public.scan_workflow_stages ws ON ws.id = cs.stage_id
    JOIN public.scan_production_chapters pc ON pc.id = COALESCE(cs.production_chapter_id, cs.chapter_id)
    JOIN public.works w ON w.id = pc.work_id
    WHERE cs.status = 'IN_PROGRESS'
      AND cs.assigned_to IS NOT NULL
      AND cs.due_at IS NOT NULL
      AND cs.due_at < now()
      AND (p_scan_id IS NULL OR cs.scan_id = p_scan_id)
    FOR UPDATE OF cs
  LOOP
    v_availability_version := COALESCE(r.availability_version, 1) + 1;

    -- Devolve stage to queue (AVAILABLE)
    UPDATE public.scan_chapter_stages
    SET status = 'AVAILABLE',
        previous_assigned_to = r.assigned_to,
        assigned_to = NULL,
        claimed_at = NULL,
        availability_version = v_availability_version,
        availability_reason = 'expired_returned_to_queue',
        notified_available = false,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = r.stage_id;

    -- Insert timeline event
    INSERT INTO public.scan_chapter_timeline (
      scan_id, production_chapter_id, stage_id, stage_slug, event_type,
      user_id, user_name, details
    ) VALUES (
      r.scan_id,
      COALESCE(r.production_chapter_id, r.chapter_id),
      r.workflow_stage_id,
      r.stage_slug,
      'EXPIRED_DEVOLUTION',
      r.assigned_to,
      'Sistema (Expiração de Prazo)',
      jsonb_build_object(
        'reason', 'Prazo de entrega expirado sem conclusão da etapa',
        'previous_assignee', r.assigned_to,
        'due_at', r.due_at,
        'extension_count', r.extension_count,
        'availability_version', v_availability_version
      )
    );

    -- Send notification to former assignee
    INSERT INTO public.notifications (
      user_id, scan_id, title, body, href, type, kind, priority, dedupe_key, created_at
    ) VALUES (
      r.assigned_to, r.scan_id,
      'Etapa devolvida à fila',
      'O prazo para concluir a etapa ' || r.stage_name || ' de ' || r.work_title || ' #' || r.chapter_number || ' expirou e ela foi devolvida à fila para outro membro assumir.',
      '/scan?tab=pipeline&stage=' || r.stage_slug,
      'STAGE_DEVOLVED', 'stage_devolved', 'HIGH',
      'stage_devolved:' || r.stage_id || ':' || r.assigned_to || ':' || to_char(r.due_at, 'YYYY-MM-DD-HH24'),
      now()
    );

    v_devolved_ids := array_append(v_devolved_ids, r.stage_id);
    v_devolved_count := v_devolved_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'devolved_count', v_devolved_count,
    'devolved_stage_ids', v_devolved_ids
  );
END;
$$;
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Successfully installed process_expired_scan_stages_ysql into YugabyteDB!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
