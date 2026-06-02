// ABOUTME: Defines when the app should bind its own HTTP server versus letting the Vite dev server host requests.
// ABOUTME: Prevents local development from opening a second listener on the same port and crashing startup.
export type RuntimeImportMetaEnv = {
  DEV?: boolean;
} | undefined;

export function shouldStartStandaloneServer(importMetaEnv?: RuntimeImportMetaEnv): boolean {
  return !importMetaEnv?.DEV;
}
