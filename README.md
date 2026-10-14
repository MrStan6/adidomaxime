# Complexe hôtelier — site web et administration

Site public et espace d'administration d'un complexe polyvalent : **deux salles
événementielles** (commercialisées dès maintenant), **hébergement** (préparé,
activable plus tard) et **services complémentaires** (activables un par un).

> **Aucune information commerciale n'est inventée.** Nom, coordonnées,
> capacités, tarifs, chambres et services restent « À renseigner » et sont
> masqués sur le site tant qu'ils ne sont pas saisis dans l'administration.
> Le site fonctionne en **mode démonstration** jusqu'au passage en production.

## Sommaire de la documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Choix techniques, arborescence, modèle de données, statuts, rôles, configuration |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Hébergement, installation serveur, domaine et HTTPS, mises à jour, retour arrière |
| [docs/EXPLOITATION.md](docs/EXPLOITATION.md) | Sauvegardes et restauration, comptes, données personnelles, supervision |
| [docs/MISE-EN-PRODUCTION.md](docs/MISE-EN-PRODUCTION.md) | Informations à fournir, activation progressive, liste de vérifications avant ouverture |
| [docs/TESTS.md](docs/TESTS.md) | Tests automatisés (résultats) et procédure de test manuel |
| [docs/APERCU-VERCEL.md](docs/APERCU-VERCEL.md) | Aperçu en ligne temporaire (Vercel + Supabase) et ses limites |

## Démarrage local (développement)

Prérequis : **Node.js 20.9+** (testé en 22) et **PostgreSQL 14+** (testé en 16).

```bash
# 1. Dépendances
npm install

# 2. Bases de données (développement + tests)
psql -U postgres -c "CREATE ROLE hotel LOGIN PASSWORD 'hotel_dev';"
psql -U postgres -c "CREATE DATABASE hotel_dev OWNER hotel;"
psql -U postgres -c "CREATE DATABASE hotel_test OWNER hotel;"
# les extensions pgcrypto et btree_gist doivent pouvoir être créées :
psql -U postgres -d hotel_dev  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist;"
psql -U postgres -d hotel_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist;"

# 3. Configuration
cp .env.example .env
# puis remplacer APP_SECRET (commande de génération indiquée dans le fichier)

# 4. Schéma et données de référence
npm run db:migrate

# 5. Premier compte administrateur (mot de passe provisoire affiché une fois)
npm run admin:create -- --email=vous@exemple.com --name="Prénom Nom"

# 6. Lancer
npm run dev            # http://localhost:3000  — administration : /admin
```

Facultatif : `npm run db:seed-demo -- --currency=XOF` crée des **chambres
fictives** (marquées « Exemple de démonstration ») pour tester le parcours de
réservation. Remplacez `XOF` par la devise de test souhaitée. Suppression :
`npm run db:seed-demo -- --remove`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tous les tests (unitaires + intégration, base `hotel_test`) |
| `npm run db:migrate` | Applique les migrations SQL en attente |
| `npm run admin:create -- --email=… --name="…" [--role=…]` | Crée un compte (admin, commercial, reception, comptabilite) |
| `npm run db:seed-demo -- --currency=XXX` | Données d'hébergement fictives (refusé en production) |
| `npm run privacy -- --erase=… \| --purge-contact-months=24` | Effacement de données personnelles, purge |

## État du projet

| Étape | État |
|---|---|
| 1. Analyse et architecture | ✅ Terminé (voir docs/ARCHITECTURE.md) |
| 2. Conception (pages, données, rôles, design system) | ✅ Terminé |
| 3. Site public (accueil, salles, devis, hôtel, galerie, contact, juridique) | ✅ Terminé |
| 4. Administration et base de données | ✅ Terminé |
| 5. Hébergement et réservations | ✅ Prêt, **désactivé** tant que chambres, tarifs et conditions ne sont pas confirmés |
| 6. Paiement et facturation | ⏸ Couche d'intégration prête ; **aucun prestataire réel** (choix après confirmation du pays et du compte marchand) |
| 7. Vérification | ✅ 76 tests automatisés exécutés et réussis, parcours vérifiés au navigateur (voir docs/TESTS.md) |
| 8. Livraison | ✅ Documentation, Docker, sauvegardes. Image Docker à construire sur le serveur cible (non testée ici, voir docs/TESTS.md) |

Ce qui reste à faire relève de l'établissement : fournir les informations
listées dans [docs/MISE-EN-PRODUCTION.md](docs/MISE-EN-PRODUCTION.md),
choisir l'hébergeur et le nom de domaine, puis valider les textes juridiques.
