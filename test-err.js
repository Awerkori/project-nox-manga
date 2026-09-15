import { error } from '@sveltejs/kit';
try {
  error(403, 'Acesso restrito');
} catch (e) {
  console.log(e);
}
