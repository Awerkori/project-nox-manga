import { createAuthClient } from "better-auth/svelte";
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "https://manga.project-nox-awerkori.workers.dev"
});
