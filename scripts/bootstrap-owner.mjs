import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
process.loadEnvFile('.env');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const source = createClient(
  process.env.STAFF_SUPABASE_URL,
  process.env.STAFF_SUPABASE_SERVICE_ROLE_KEY,
  options
);
const target = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const sourceId = process.env.STAFF_OWNER_USER_ID;
if(!sourceId)throw new Error('Identificador do owner deve ser informado no ambiente privado.');
const { data: member, error: staffError } = await source
  .from('staff_members')
  .select('user_id,is_admin,is_active')
  .eq('user_id', sourceId)
  .single();
if (staffError || !member.is_admin || !member.is_active) throw new Error('Owner da central não confirmado.');
const {
  data: { user },
  error: sourceError
} = await source.auth.admin.getUserById(sourceId);
if (sourceError || !user.email || !user.email_confirmed_at)
  throw new Error('Identidade verificada indisponível.');
const {
  data: { users },
  error: listError
} = await target.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
let owner = users.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
if (!owner) {
  const { data, error } = await target.auth.admin.createUser({
    email: user.email,
    password: randomBytes(40).toString('base64url'),
    email_confirm: true
  });
  if (error) throw error;
  owner = data.user;
}
const { error } = await target.from('access_roles').update({ role: 'ADMIN' }).eq('user_id', owner.id);
if (error) throw error;
await target.from('members').update({ username: 'awerkori', display_name: 'Awerkori' }).eq('id', owner.id);
console.log(
  'Owner configurado com a identidade já verificada da central. Nenhum e-mail ou credencial exibido.'
);
