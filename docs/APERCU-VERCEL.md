# Aperçu en ligne (Vercel + Supabase)

Cet aperçu sert à **montrer le site** pendant que les informations réelles
sont rassemblées. Il fonctionne en **mode démonstration** (bandeau visible,
non référencé par les moteurs de recherche). L'hébergement définitif
recommandé reste celui de [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Composition

| Élément | Où |
|---|---|
| Application | Vercel, projet `adidomaxime` (relié au dépôt GitHub du même nom) |
| Base de données | Supabase, projet `adidomaxime` (région eu-west-3, offre gratuite) |
| Schéma | `hotel` (et non `public`, qui est exposé par l'API REST de Supabase) |
| Rôle de connexion | `hotel_app`, propriétaire du seul schéma `hotel` |

## Variables d'environnement Vercel

`APP_MODE=demo`, `SITE_URL`, `DATABASE_URL` (pooler Supabase en mode
session, utilisateur `hotel_app.<ref-projet>`), `DATABASE_SSL=no-verify`,
`DATABASE_POOL_MAX=3`, `APP_SECRET`, `TRUST_PROXY=true`,
`PAYMENT_PROVIDER=none`, `EMAIL_PROVIDER=none`.

`DATABASE_SSL=no-verify` : la connexion est chiffrée, mais l'autorité du
certificat Supabase n'est pas vérifiée (son certificat racine n'est pas
reconnu publiquement). Pour une vérification stricte : télécharger le
certificat dans Supabase → Database Settings → SSL, le coller dans
`DATABASE_SSL_CA` et passer `DATABASE_SSL=true`.

## Migrations

La commande de build du projet Vercel est
`npm run db:migrate && npm run build` : les nouvelles migrations sont
appliquées automatiquement à chaque déploiement, avec le même script qu'en
local (transaction, sommes de contrôle).

## Limites de l'aperçu

- **Photos** : l'envoi depuis l'administration est volontairement refusé
  (le disque de Vercel est effacé régulièrement, les photos disparaîtraient).
- **Courriels** : désactivés ; les demandes restent visibles dans l'administration.
- **Offres gratuites** : Vercel Hobby et Supabase Free ont des quotas, et un
  projet Supabase gratuit inactif peut être mis en pause. Ces offres ne sont
  pas garanties dans la durée.
- Les demandes de devis envoyées sur l'aperçu sont de vraies données
  personnelles : ne pas le diffuser au public comme site officiel.
