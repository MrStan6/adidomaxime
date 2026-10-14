# Architecture

## 1. Choix techniques

| Élément | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js 16 (App Router) + TypeScript** | Un seul projet pour le site public, l'administration et le serveur ; pages rendues côté serveur (rapides sur mobile, bien référencées) ; très répandu, donc facile à reprendre par un autre développeur. |
| Interface | **Tailwind CSS 4**, composants maison accessibles | Pas de bibliothèque d'interface lourde ; styles cohérents via des variables de thème. |
| Base de données | **PostgreSQL 16** (14+ accepté) via `pg` | Contraintes d'exclusion natives pour **interdire les doubles réservations au niveau de la base**, transactions, fiabilité. |
| Accès aux données | **SQL paramétré** (`$1, $2…`), sans ORM | Requêtes lisibles, aucune concaténation de valeurs, migrations SQL transparentes, une dépendance de moins. |
| Validation | **Zod** | Mêmes schémas côté serveur pour tous les formulaires et les variables d'environnement. |
| Authentification | Sessions en base (jeton aléatoire, haché SHA-256), mots de passe **bcrypt**, cookie `HttpOnly`/`Secure`/`SameSite=Lax` | Solution simple, éprouvée et sans service externe payant ; révocation immédiate possible. |
| Courriels | **Nodemailer** (SMTP), désactivé par défaut | Compatible avec la plupart des fournisseurs (Brevo, Mailjet, OVH, Google Workspace…). |
| Images | `next/image` + **sharp** (AVIF/WebP, tailles adaptées), chargement différé | Pages légères sur connexion mobile. |
| Tests | **Vitest** (unitaires + intégration sur vraie base PostgreSQL) | Les garanties critiques (double réservation, idempotence des paiements) sont testées contre la base réelle. |
| Déploiement | **Docker Compose** sur un VPS : application + PostgreSQL + Caddy (HTTPS automatique) | Coût mensuel prévisible et faible, photos stockées sur disque, aucun service propriétaire indispensable. |

Polices auto-hébergées (`@fontsource`) : aucun appel à Google Fonts, donc
pas de transfert de données de visiteurs à un tiers.

## 2. Arborescence

```
db/migrations/            Migrations SQL numérotées (appliquées dans l'ordre, sommes de contrôle)
deploy/                   docker-compose.yml, Caddyfile, .env.example, backup.sh, restore.sh
docs/                     Documentation
public/placeholders/      Images provisoires (signalées « Image provisoire » sur le site)
scripts/                  Commandes : migrate, create-admin, seed-demo, privacy
src/
  app/
    (public)/             Pages publiques : accueil, hotel, salles, devis, hebergement,
                          services, galerie, contact, [legal] (pages juridiques), paiement de démo
    admin/                Espace d'administration (connexion + (espace)/… protégé)
    api/health            Sonde de santé (déploiement)
    api/payments/webhook  Notifications des prestataires de paiement
    media/[...path]       Service des photos envoyées (protection contre la traversée de répertoires)
    sitemap.ts, robots.ts, icon.svg, not-found.tsx, error.tsx
  components/
    public/               En-tête, pied de page, formulaires (devis, contact, réservation)…
    admin/                Formulaires et navigation d'administration
    ui/                   Badges, icônes, champs de formulaire
  lib/                    Code partagé sans accès serveur : validation, formats, liens WhatsApp/tél.
  server/                 Code serveur uniquement
    auth/                 Sessions, mots de passe, permissions
    booking/              Moteur de réservation des chambres
    payments/             Interface prestataires, prestataire de démonstration, service
    repositories/         Accès aux données par domaine (devis, salles, médias…)
    security/             Limitation de débit, anti-robots, chiffrement, IP
    email/                Envoi des notifications
    settings.ts           Paramètres de l'établissement (« vide = non affiché »)
    content.ts            Textes éditables et pages juridiques
    privacy.ts            Effacement et purge des données personnelles
tests/
  unit/                   Validation, permissions, liens de contact, configuration
  integration/            Devis, salles, chambres, paiements, authentification, migrations, données personnelles
```

## 3. Arborescence du site

**Public** : `/` · `/hotel` · `/salles` · `/salles/[slug]` · `/devis`
(`?salle=…&type=disponibilite`) · `/hebergement` (+ `/recherche`, `/reserver`,
`/reservation/[reference]`, visibles seulement si la réservation est activée) ·
`/services` · `/galerie` (`?categorie=…`) · `/contact` · `/mentions-legales` ·
`/confidentialite` · `/cookies` · `/conditions-reservation` ·
`/conditions-annulation` · `/conditions-location-salles`.

**Administration** (`/admin`, non indexée) : tableau de bord · demandes de
devis · messages · réservations de salles (calendrier, blocages) ·
hébergement (catégories, chambres, tarifs, réservations) · paiements ·
fiches des salles · services · photos · textes et FAQ · paramètres ·
utilisateurs · journal.

## 4. Parcours principaux

1. **Demande de devis** (priorité) : fiche salle → « Demander un devis » ou
   « Vérifier la disponibilité » → formulaire (validation immédiate, erreurs en
   clair, saisie conservée) → référence `DV-AAAA-NNNNNN` et message explicite :
   *ce n'est pas une réservation*. L'équipe est notifiée par courriel si SMTP
   est configuré ; la demande apparaît dans l'administration dans tous les cas.
2. **Traitement commercial** : nouveau → à traiter → devis en préparation →
   devis envoyé → en négociation → accepté / refusé / annulé. Commentaires
   internes, relances datées, montant du devis, responsable.
3. **Réservation de salle** (administration) : création d'une **option** ou
   d'une réservation **confirmée** depuis un devis accepté ; la confirmation
   exige d'attester que les conditions de la direction sont remplies.
4. **Réservation de chambre** (quand activée) : recherche → choix → contrôle
   serveur des dates/capacité/prix → coordonnées → récapitulatif →
   acceptation des conditions → paiement (si prestataire configuré) ou
   confirmation par l'équipe → référence unique `RC-…`.
5. **Contact** : formulaire, ou WhatsApp/téléphone avec message prérempli
   **uniquement** si les numéros sont configurés.

## 5. Modèle de données

Tables principales (détail complet et commenté : `db/migrations/0001_schema.sql`) :

| Domaine | Tables |
|---|---|
| Accès | `users` (rôle), `sessions`, `rate_limit_events` |
| Clients | `customers` (anonymisables) |
| Salles | `venues`, `venue_capacities` (publiées seulement si validées), `venue_bookings` (options, réservations, **blocages**) |
| Commercial | `quote_requests`, `quote_notes`, `contact_messages` |
| Hébergement | `room_types`, `rooms` (statut d'exploitation), `room_rates` (périodes tarifaires), `room_reservations`, `room_reservation_units` (occupation par chambre physique) |
| Finances | `payments`, `payment_events` (notifications reçues), `invoices`, `invoice_lines`, `invoice_counters` |
| Contenus | `media`, `services`, `settings`, `content_blocks` (avec `locale`), `faqs` |
| Traçabilité | `audit_log` (ajout seul), colonnes `created_by` / `updated_by` / dates |

Garanties assurées **par la base** (pas seulement par le code) :

- **Aucun chevauchement** d'options/réservations/blocages sur une même salle
  (`EXCLUDE USING gist … tstzrange`), ni sur une même chambre physique
  (`daterange`), ni de périodes tarifaires.
- **Suppression interdite** des devis, réservations, paiements et factures
  (déclencheurs) ; on utilise un statut d'annulation. Journal en ajout seul.
- Une notification de paiement n'est traitée **qu'une fois**
  (`UNIQUE (provider, event_id)`) ; un paiement « réussi » exige une date de
  confirmation ; une saisie manuelle exige l'utilisateur qui l'a faite.
- Numérotation des factures continue par année, attribuée à l'émission sous verrou.
- Une demande issue du site doit porter la date d'acceptation de la politique de confidentialité.

### Statuts (volontairement distincts)

| Objet | Statuts |
|---|---|
| Demande de devis | `new` nouveau · `to_process` à traiter · `preparing` devis en préparation · `sent` envoyé · `negotiation` · `accepted` · `refused` · `cancelled` |
| Occupation de salle | `option` (bloque la salle, non confirmée) · `confirmed` · `completed` · `cancelled` ; type `booking` ou `block` (maintenance, usage interne, travaux) |
| Réservation de chambre | `pending_payment` (délai limité) · `pending_confirmation` · `confirmed` · `checked_in` · `checked_out` · `cancelled` · `expired` · `no_show` |
| Paiement | `pending` · `succeeded` (uniquement sur confirmation serveur) · `failed` · `cancelled` · `refunded` ; indicateur `is_demo` |
| Facture | `draft` · `issued` · `cancelled` |
| Service | `planned` · `available` · `suspended` + `is_published` |
| Chambre physique | `planned` · `under_works` · `ready` · `in_service` · `out_of_service` |

## 6. Rôles et permissions

Vérifiées **côté serveur** à chaque page et à chaque action
(`src/server/auth/permissions.ts`, testées dans `tests/unit/permissions.test.ts`).

| Permission | Admin | Commercial | Réception | Comptabilité |
|---|:-:|:-:|:-:|:-:|
| Tableau de bord | ✓ | ✓ | ✓ | ✓ |
| Montants et chiffre d'affaires | ✓ | ✓ | – | ✓ |
| Voir / gérer les devis | ✓ / ✓ | ✓ / ✓ | ✓ / – | – |
| Messages de contact | ✓ | ✓ | ✓ | – |
| Voir / gérer les réservations de salles | ✓ / ✓ | ✓ / ✓ | ✓ / – | ✓ / – |
| Fiches des salles | ✓ | ✓ | – | – |
| Hébergement : voir / configurer / gérer les réservations | ✓ / ✓ / ✓ | ✓ / – / – | ✓ / – / ✓ | ✓ / – / – |
| Paiements : voir / saisir | ✓ / ✓ | – | – | ✓ / ✓ |
| Factures | ✓ | – | – | ✓ |
| Textes, photos, services, FAQ | ✓ | ✓ | – | – |
| Paramètres de l'établissement | ✓ | – | – | – |
| Utilisateurs | ✓ | – | – | – |
| Journal des opérations | ✓ | – | – | – |

Chaque personne a son propre compte ; un administrateur ne peut pas
désactiver son propre compte ni retirer le dernier administrateur actif.

## 7. Configuration

Deux niveaux, pour qu'aucune donnée commerciale ne soit dans le code :

1. **Variables d'environnement** (`.env`, voir `.env.example`) : technique et
   secrets — `APP_MODE` (`demo`/`production`), `SITE_URL`, `DATABASE_URL`,
   `APP_SECRET`, `UPLOAD_DIR`, SMTP, `PAYMENT_PROVIDER` (`none`/`demo`)…
   Validées au démarrage ; combinaisons dangereuses refusées (paiement de
   démonstration en production, secret d'exemple en production…).
2. **Paramètres en base** (administration → Paramètres) : nom, logo,
   coordonnées, adresse, point géographique **avec case « vérifié »**,
   horaires, devise, moyens de paiement, informations légales, réseaux
   sociaux, statut public de l'hébergement, activation de la réservation.
   **Valeur vide = élément masqué sur le site.**

Textes de pages, FAQ, services et pages juridiques sont modifiables dans
l'administration (`content_blocks`, colonne `locale` prévue pour une
seconde langue).

## 8. Mode démonstration / production

| | `APP_MODE=demo` | `APP_MODE=production` |
|---|---|---|
| Bandeau « Site en démonstration » | affiché | absent |
| Données marquées `is_demo` | visibles, étiquetées « Exemple » | **masquées** |
| Prestataire de paiement fictif | autorisé (étiqueté) | **refusé au démarrage** |
| Indexation (robots, sitemap) | interdite | autorisée |
| Réservation de chambres | possible si prérequis remplis | exige en plus pages juridiques validées, conditions finalisées, chambres réelles « en service » avec tarif |

## 9. Paiements

`src/server/payments/` définit l'interface `PaymentProvider`
(`createCheckout`, `verifyWebhook`). Aucun prestataire réel n'est branché.
Pour en ajouter un (Mobile Money, agrégateur, banque) : implémenter
l'interface, l'enregistrer dans `registry.ts`, ajouter sa valeur à
`PAYMENT_PROVIDER` dans `src/server/env.ts`, compléter la politique de
sécurité de contenu (`next.config.ts`, `form-action`) et écrire ses tests
(signature invalide, notification répétée, montant incohérent).
Le statut « payé » ne vient **jamais** du retour navigateur, uniquement de
la notification serveur authentifiée.

## 10. Sécurité (résumé)

Validation serveur de toutes les entrées · SQL paramétré · contrôle des
permissions sur chaque action · limitation des tentatives de connexion et
des envois de formulaires · pot de miel + jeton horodaté anti-robots ·
cookies de session sécurisés · en-têtes de sécurité (CSP, HSTS,
X-Frame-Options…) · administration non indexée et non mise en cache ·
contrôle du type réel des images envoyées · journal des opérations ·
aucune donnée de carte bancaire stockée ni transmise.
