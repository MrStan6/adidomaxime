# Tests

## 1. Lancer les tests

```bash
npm run typecheck          # TypeScript
npm test                   # 76 tests : unitaires + intégration
npm run test:unit          # sans base de données
npm run test:integration   # base dédiée : TEST_DATABASE_URL (par défaut hotel_test)
```

Les tests d'intégration **recréent entièrement** le schéma de la base visée ;
par sécurité, ils refusent de s'exécuter si le nom de la base ne contient
pas « test ». Ils tournent aussi automatiquement sur GitHub à chaque envoi
de code (`.github/workflows/ci.yml`).

## 2. Résultats de la dernière exécution (14 octobre 2026)

Environnement : Node.js 22.22, PostgreSQL 16, Linux.

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | ✅ aucune erreur |
| `npm test` | ✅ **76 / 76 réussis** (9 fichiers) |
| `npm run build` (avec et sans accès à la base) | ✅ réussi |
| Serveur « standalone » (contenu de l'image Docker) lancé et interrogé | ✅ santé, pages, CSS, 404, icône |
| Sauvegarde `pg_dump` → restauration `pg_restore` dans une base vierge | ✅ nombres de lignes identiques, migrations reconnues |
| Construction de l'image Docker elle-même | ⚠ **non testée** : le registre Docker Hub n'était pas accessible depuis l'environnement de développement. À faire lors de la première installation (`docker compose build`). |

### Couverture des points exigés

| Exigence | Test automatisé |
|---|---|
| Formulaires incomplets ou invalides, messages compréhensibles | `unit/validation` (11 cas) |
| Création et modification d'une demande de devis, transitions de statut | `integration/quotes-and-venues` |
| Permissions des utilisateurs | `unit/permissions` (6 cas) |
| Accès non autorisé (identifiants faux, compte désactivé, blocage après échecs, sessions) | `integration/auth-dashboard-invoices` |
| Conflits de réservation d'une même salle, y compris simultanés, blocages de maintenance | `integration/quotes-and-venues` |
| Doubles réservations de chambres, y compris simultanées, et contrainte en base | `integration/rooms-and-payments` |
| Prix calculé côté serveur, nuits sans tarif refusées | `integration/rooms-and-payments` |
| Erreurs du prestataire de paiement, montant/devise incohérents | `integration/rooms-and-payments` |
| Notifications de paiement répétées (pas de double encaissement) | `integration/rooms-and-payments` |
| Confirmation de paiement uniquement par notification signée | `integration/rooms-and-payments` |
| Paiement de démonstration refusé en production | `integration/rooms-and-payments` |
| Absence de données (tableau de bord à zéro, sans chiffre inventé) | `integration/auth-dashboard-invoices` |
| Coordonnées non configurées (rien d'affiché, GPS non vérifié jamais publié) | `unit/contact-and-config` |
| Statut d'hébergement honnête (jamais « ouvert » en démonstration) | `unit/contact-and-config` |
| Migrations (base vide, rejouables, modification détectée, échec annulé) | `integration/migrations` |
| Traçabilité (suppression interdite, historique) | `integration/quotes-and-venues` |
| Effacement et purge des données personnelles | `integration/privacy` |
| Anti-robots des formulaires | `unit/form-guard-and-rules` |

### Vérifications au navigateur (Chromium automatisé)

Effectuées sur la version de production, en mode démonstration, aux
largeurs **390 px (téléphone), 820 px (tablette) et 1440 px (ordinateur)** :

- 11 pages publiques : aucun débordement horizontal, aucune image cassée, aucune erreur serveur.
- Exploration de tous les liens internes du site public : **aucun lien cassé** (26 adresses visitées).
- Formulaire de devis sur téléphone : envoi vide → 10 messages d'erreur clairs ;
  envoi valide → référence `DV-…` et mention explicite que ce n'est pas une réservation ;
  demande retrouvée dans l'administration.
- Administration : accès sans session redirigé vers la connexion ; mauvais mot de passe refusé ;
  rôle Réception redirigé vers « accès refusé » pour Utilisateurs, Paramètres, Paiements et Journal.
- Saisie conservée après une erreur (connexion et fiches d'administration).

Défauts trouvés et corrigés lors de cette vérification :

1. Le badge « Réservation en ligne ouverte » s'affichait en mode démonstration → remplacé par « Démonstration : réservation fictive » (test ajouté).
2. Le champ e-mail se vidait après un échec de connexion → conservé.
3. Les formulaires d'administration perdaient la saisie en cas d'erreur de validation → conservée (vérifié au navigateur).
4. Le build échouait sans base de données accessible (cas de l'image Docker) → métadonnées rendues à la demande.
5. Icône de site manquante (erreur 404) → ajoutée.

### Non testé à ce stade

- Construction de l'image Docker et HTTPS réel (à faire sur le serveur).
- Envoi réel de courriels (aucun serveur SMTP configuré).
- Prestataire de paiement réel (aucun choisi).
- Appareils physiques et lecteurs d'écran (seules des tailles d'écran ont été simulées).

## 3. Procédure de test manuel

À réaliser avant l'ouverture, puis après chaque mise à jour importante.
Utiliser un vrai téléphone (Android et iPhone si possible) et un ordinateur.

### Site public

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvrir l'accueil sur téléphone depuis un lien WhatsApp | Chargement rapide, menu ☰ fonctionnel, bouton « Demander un devis » visible en bas d'écran |
| 2 | Parcourir chaque entrée du menu et du pied de page | Aucune page introuvable |
| 3 | Ouvrir une adresse inexistante (`/xyz`) | Page « Cette page n'existe pas » avec liens de retour |
| 4 | Fiche salle → « Demander un devis » | Formulaire avec la salle présélectionnée |
| 5 | Envoyer le formulaire vide | Erreurs en clair sous chaque champ, saisie conservée |
| 6 | Date passée, heure de fin avant le début, téléphone invalide | Message spécifique pour chaque cas |
| 7 | Envoyer une demande valide | Référence affichée ; « ce n'est pas une réservation » |
| 8 | Envoyer 6 demandes en moins d'une heure depuis le même appareil | La 6ᵉ est refusée poliment |
| 9 | Bouton WhatsApp (si numéro configuré) | WhatsApp s'ouvre avec un message prérempli adapté |
| 10 | Bouton téléphone (si configuré) | Le téléphone propose d'appeler le bon numéro |
| 11 | Retirer temporairement le téléphone dans Paramètres | Plus aucun bouton d'appel nulle part |
| 12 | Galerie : filtres par catégorie, navigation au clavier (Tab) | Contour de focus visible, textes alternatifs présents |
| 13 | Page Hébergement (réservation non activée) | « Ouverture à venir » ou « à confirmer », aucun formulaire de réservation |
| 14 | Pages juridiques | Bandeau « en cours de finalisation » tant que non validées |

### Administration

| # | Action | Résultat attendu |
|---|---|---|
| 15 | Ouvrir `/admin/demandes` sans être connecté | Redirection vers la connexion |
| 16 | 5 mauvais mots de passe puis le bon | Blocage temporaire annoncé |
| 17 | Première connexion avec mot de passe provisoire | Changement de mot de passe exigé |
| 18 | Demande reçue : passer à « à traiter », ajouter un commentaire, une relance | Historique mis à jour, journal alimenté |
| 19 | Tenter « nouveau » → « accepté » directement | Transition refusée avec explication |
| 20 | Poser une option sur la salle 1 de 9 h à 12 h, puis une autre de 11 h à 14 h | Seconde refusée (conflit) |
| 21 | Même créneau sur la salle 2 | Accepté |
| 22 | Bloquer la salle 1 pour maintenance | Créneau indisponible pour toute réservation |
| 23 | Confirmer une option sans cocher l'attestation des conditions | Refusé |
| 24 | Se connecter en Réception, Comptabilité, Commercial | Menus et pages limités au rôle ; adresses tapées à la main → « accès refusé » |
| 25 | Envoyer une photo non image (PDF renommé .jpg) | Refusée |
| 26 | Envoyer une photo sans texte alternatif | Refusée |
| 27 | Dépublier un service | Il disparaît du site public |
| 28 | Base vide (nouvelle installation) | Tableau de bord à zéro, aucun chiffre fictif |

### Hébergement et paiement (en mode démonstration uniquement)

| # | Action | Résultat attendu |
|---|---|---|
| 29 | `npm run db:seed-demo -- --currency=XXX`, activer la réservation | Chambres étiquetées « Exemple de démonstration », badge « réservation fictive » |
| 30 | Réserver la dernière chambre disponible dans deux navigateurs en même temps | Une seule réservation aboutit |
| 31 | Paiement de démonstration : revenir sur la page sans valider | Réservation toujours « en attente de paiement » |
| 32 | Laisser expirer le délai de paiement | Chambre de nouveau disponible |
| 33 | Passer `APP_MODE=production` avec `PAYMENT_PROVIDER=demo` | L'application refuse de démarrer |
