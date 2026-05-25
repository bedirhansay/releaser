// Next.js runs `register()` once when the server process boots. We use it to
// validate the environment up-front so a misconfigured deploy fails fast with a
// clear message instead of throwing on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("@/shared/env");
    validateServerEnv();
  }
}
