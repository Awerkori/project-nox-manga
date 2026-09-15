import { error } from '@sveltejs/kit';

async function run() {
  try {
    error(503, 'TEST');
  } catch (e) {
    console.log("Caught:", e.status);
  }
}
run();
