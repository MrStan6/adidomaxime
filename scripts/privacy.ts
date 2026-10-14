/**
 * Données personnelles : effacement sur demande et purge périodique.
 *
 *   npm run privacy -- --erase=personne@exemple.com
 *       Anonymise le client et ses messages (les réservations, devis,
 *       paiements et factures restent, sans données identifiantes).
 *
 *   npm run privacy -- --purge-contact-months=24
 *       Supprime les messages de contact traités/archivés de plus de 24 mois.
 *
 * Les durées de conservation sont à fixer par la direction selon la loi
 * applicable dans le pays de l'établissement (voir docs/EXPLOITATION.md).
 */
import { loadEnv } from "./_env";
loadEnv();

import { pool } from "../src/server/db";
import { eraseCustomerData, purgeOldContactMessages } from "../src/server/privacy";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const email = arg("erase");
  const months = arg("purge-contact-months");
  if (!email && !months) {
    throw new Error("Usage : npm run privacy -- --erase=adresse@exemple.com | --purge-contact-months=24");
  }
  if (email) {
    const r = await eraseCustomerData(email);
    console.log(`✓ Effacement : ${r.customers} fiche(s) client et ${r.contactMessages} message(s) anonymisé(s).`);
  }
  if (months) {
    const n = await purgeOldContactMessages(Number(months));
    console.log(`✓ Purge : ${n} message(s) de contact supprimé(s).`);
  }
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
