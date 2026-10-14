# Mise en production

Le site a été construit pour **ne rien inventer** : tout ce qui n'est pas
saisi reste masqué ou affiché « à confirmer ». Le tableau de bord de
l'administration affiche en permanence la liste « Configuration à
compléter » calculée à partir des données réelles.

## 1. Informations à fournir par l'établissement

### Indispensables avant l'ouverture publique

| Information | Où la saisir |
|---|---|
| Nom commercial définitif (et slogan éventuel) | Paramètres |
| Logo officiel (fichier SVG ou PNG haute définition) | Paramètres |
| Téléphone officiel | Paramètres |
| Numéro WhatsApp au format international (+…) | Paramètres |
| Adresse électronique officielle | Paramètres |
| Adresse postale complète, ville, pays, indications d'accès | Paramètres |
| Coordonnées GPS **relevées sur place** (puis cocher « vérifié ») | Paramètres |
| Fuseau horaire et horaires d'accueil | Paramètres |
| Devise | Paramètres |
| Informations légales : raison sociale, forme, n° d'immatriculation, n° fiscal, directeur de publication, hébergeur | Paramètres |
| Pour chaque salle : nom définitif, description, superficie, capacités par configuration (théâtre, classe, U, banquet, cocktail, réunion), équipements, services inclus et en option, conditions de réservation, tarif ou « sur demande » | Fiches des salles |
| Photographies **réelles** de l'établissement et des salles, avec un texte alternatif | Photos |
| Textes juridiques complétés et **validés par un juriste du pays** | Textes et FAQ |
| Nom de domaine et hébergeur choisis | voir DEPLOIEMENT.md |

### À fournir au fur et à mesure

| Information | Débloque |
|---|---|
| Services réellement disponibles (restauration, Wi-Fi, parking…) | Leur affichage sur la page Services et l'accueil |
| Chambres : catégories, nombre, lits, capacité, équipements, règles, photos, tarifs par période, conditions d'annulation, date d'ouverture | La page Hébergement puis la réservation |
| Moyens de paiement acceptés sur place | Leur mention sur le site |
| Pays + prestataire de paiement + compte marchand | Le paiement en ligne |
| Réseaux sociaux officiels | Les liens en pied de page |
| Fournisseur de courriel (SMTP) | Les notifications automatiques |
| Questions fréquentes | La FAQ |

## 2. Activation progressive

1. **Salles (immédiat)** : compléter les fiches, valider les capacités (une
   capacité non cochée « validée » n'est jamais publiée), remplacer les
   images provisoires.
2. **Services** : pour chaque service réellement ouvert, statut
   « disponible » + « publié ». Un service non publié n'apparaît nulle part.
3. **Hébergement**, dans l'ordre :
   1. Paramètres → statut public « Informations à confirmer » (annonce sans réservation) ;
   2. Hébergement → créer les catégories, les chambres physiques, les tarifs par période ;
   3. passer chaque chambre prête au statut « en service » ;
   4. finaliser les conditions de réservation et d'annulation ;
   5. statut public « ouvert » + réservation en ligne activée.
   L'activation reste **refusée** tant qu'un prérequis manque ; la liste des
   prérequis manquants est affichée dans Administration → Hébergement.
   Mode de paiement « à la confirmation » : la réservation est enregistrée
   « en attente de confirmation » et l'équipe confirme ; aucun paiement en
   ligne n'est demandé.
4. **Paiement en ligne** : après choix du prestataire, intégration par un
   développeur (voir ARCHITECTURE.md § 9), tests en environnement de test du
   prestataire, puis activation. Le prestataire de démonstration est refusé
   en production.
5. **Mesure d'audience** : aucun outil n'est intégré. Après mise à jour de la
   politique de confidentialité (et du bandeau cookies si l'outil en
   dépose), un développeur peut ajouter une solution respectueuse de la vie
   privée (Plausible, Matomo auto-hébergé…) derrière le paramètre
   `analytics.enabled`, en complétant la politique de sécurité de contenu
   dans `next.config.ts`.
6. **Seconde langue** : les textes éditables portent déjà une colonne
   `locale` ; l'ajout d'une langue demande une évolution du code (routes
   `/en/…`, traduction des libellés d'interface).

## 3. Liste de vérifications avant ouverture

À cocher dans l'ordre, sur le serveur de production :

**Configuration**
- [ ] Le tableau de bord n'affiche plus d'élément « À renseigner » bloquant.
- [ ] `APP_MODE=production` ; le bandeau « démonstration » a disparu.
- [ ] `PAYMENT_PROVIDER=none` (ou prestataire réel testé).
- [ ] `APP_SECRET` et `POSTGRES_PASSWORD` générés aléatoirement, `deploy/.env` en `chmod 600`, copie dans un coffre-fort.
- [ ] Aucune donnée de démonstration (`npm run db:seed-demo -- --remove`).
- [ ] Les comptes de test éventuels sont désactivés ; chaque membre de l'équipe a son compte et a changé son mot de passe provisoire.

**Contenu**
- [ ] Noms définitifs des salles (plus de « nom provisoire »).
- [ ] Plus aucune « Image provisoire » sur l'accueil, les salles et la galerie.
- [ ] Toutes les photos ont un texte alternatif descriptif.
- [ ] Pages juridiques complétées, validées et case « validées » cochée (le bandeau « en cours de finalisation » disparaît).
- [ ] Coordonnées vérifiées : appeler le numéro affiché, envoyer un WhatsApp via le bouton du site, écrire à l'adresse affichée.
- [ ] Carte : le repère tombe bien sur l'entrée de l'établissement.

**Fonctionnement**
- [ ] `https://votre-domaine.com/api/health` → `ok` ; `http://` redirige vers `https://` ; `www` redirige vers le domaine principal.
- [ ] Envoyer une vraie demande de devis depuis un téléphone : référence affichée, demande visible dans l'administration, courriel de notification reçu (si SMTP).
- [ ] Envoyer un message de contact : visible dans Messages.
- [ ] Se connecter avec chaque rôle et vérifier qu'il ne voit que ce qui le concerne.
- [ ] Poser une option sur une salle puis tenter une seconde option sur le même créneau : refus attendu.
- [ ] Sauvegarde automatique active, copie hors site active, **une restauration testée**.
- [ ] Surveillance de disponibilité configurée sur `/api/health`.

**Référencement**
- [ ] `https://votre-domaine.com/robots.txt` autorise l'indexation et cite le sitemap.
- [ ] `https://votre-domaine.com/sitemap.xml` liste les pages.
- [ ] Site déclaré dans Google Search Console ; fiche Google Business Profile cohérente avec le site.
- [ ] Aperçu de partage correct (coller le lien dans WhatsApp).

## 4. Risques à suivre

| Risque | Mesure |
|---|---|
| Publication d'informations non validées | Valeurs vides masquées, capacités à valider, mode démo, liste de configuration |
| Double réservation d'une salle ou d'une chambre | Contraintes d'exclusion en base + tests automatisés |
| Confusion devis / réservation / paiement | Statuts séparés, messages explicites côté visiteur |
| Paiement affiché comme reçu à tort | Confirmation par notification serveur uniquement, prestataire fictif interdit en production |
| Perte de données | Sauvegarde quotidienne + copie hors site + restauration testée |
| Textes juridiques non conformes | Modèles signalés « à compléter », validation par un juriste local obligatoire |
| Dépendance à un seul prestataire technique | Code standard, documenté, déployable chez n'importe quel hébergeur |
| Courriels non reçus | Demandes toujours visibles dans l'administration ; SPF/DKIM à configurer |
| Spam via les formulaires | Pot de miel, jeton horodaté, limitation par heure |
