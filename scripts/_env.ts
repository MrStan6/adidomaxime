import { existsSync } from "node:fs";

/** Charge .env (si présent) pour les scripts en ligne de commande. */
export function loadEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");
}
