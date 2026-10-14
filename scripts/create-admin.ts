/**
 * Création d'un compte administrateur (ou autre rôle).
 *
 *   npm run admin:create -- --email=direction@exemple.com --name="Prénom Nom" [--role=admin]
 *
 * Mot de passe : variable ADMIN_PASSWORD si fournie, sinon un mot de passe
 * provisoire aléatoire est généré et affiché UNE seule fois ; il devra être
 * changé à la première connexion.
 */
import { loadEnv } from "./_env";
loadEnv();

import { randomBytes } from "node:crypto";
import { pool } from "../src/server/db";
import { createUser } from "../src/server/repositories/users";
import { passwordSchema } from "../src/server/auth/password";
import { isRole } from "../src/server/auth/permissions";

function arg(name: string) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a?.slice(name.length + 3);
}

async function main() {
  const email = arg("email");
  const name = arg("name");
  const role = arg("role") ?? "admin";
  if (!email || !name) throw new Error('Usage : npm run admin:create -- --email=adresse@exemple.com --name="Prénom Nom" [--role=admin|commercial|reception|comptabilite]');
  if (!isRole(role)) throw new Error(`Rôle inconnu : ${role}`);
  const provided = process.env.ADMIN_PASSWORD;
  const password = provided ?? `${randomBytes(9).toString("base64url")}-${Math.floor(Math.random() * 90 + 10)}`;
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0]!.message);
  await createUser({ email, full_name: name, role, password, must_change_password: !provided }, null);
  console.log(`✓ Compte créé : ${email} (${role})`);
  if (!provided) console.log(`  Mot de passe provisoire (à changer à la première connexion) : ${password}`);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
