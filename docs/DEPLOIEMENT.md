# Déploiement

> Rien n'a été publié, aucun compte externe n'a été créé et aucune dépense
> n'a été engagée. Les étapes ci-dessous sont à réaliser par l'établissement
> ou son prestataire, après validation.

## 1. Hébergement recommandé

**Un serveur virtuel (VPS) Linux** avec Docker, qui héberge l'application,
la base PostgreSQL et le certificat HTTPS.

- Ressources suffisantes au démarrage : 2 vCPU, 2 à 4 Go de mémoire, 40 Go de disque.
- Fournisseurs possibles (liste non exhaustive, sans partenariat) : OVHcloud,
  Hetzner, Scaleway, Contabo, DigitalOcean, ou un hébergeur local du pays de
  l'établissement — ce dernier peut offrir une meilleure latence pour les
  visiteurs locaux et faciliter la facturation.
- **Coût** : de l'ordre de quelques euros à une vingtaine d'euros par mois
  selon le fournisseur et la région, plus le nom de domaine (généralement
  annuel). **Ces tarifs évoluent : vérifiez-les au moment de la commande.**
  Aucune offre gratuite n'est supposée durable.
- Prévoir en plus un **espace de stockage externe** pour les copies de
  sauvegarde (stockage objet ou autre serveur) — voir EXPLOITATION.md.

**Pourquoi pas une plateforme « serverless » (Vercel, etc.) ?** Les photos
envoyées depuis l'administration sont enregistrées sur disque, ce qui
n'est pas compatible avec ces plateformes sans adaptation (stockage objet
à ajouter dans `src/server/uploads.ts` et `src/app/media/`). C'est
possible plus tard, mais le VPS reste l'option la plus simple et la plus
prévisible pour ce projet.

**Dépendances externes** : aucune obligatoire. Facultatives : serveur SMTP
pour les courriels, prestataire de paiement (plus tard), OpenStreetMap pour
la carte (affichée seulement si la localisation est vérifiée).

## 2. Préparer le serveur (une fois)

Sur un serveur Debian/Ubuntu récent, connecté en SSH avec un utilisateur
disposant de `sudo` :

```bash
# Mises à jour et pare-feu : seuls SSH, HTTP et HTTPS sont ouverts
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw git
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# Docker (méthode officielle : https://docs.docker.com/engine/install/)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # puis se déconnecter / reconnecter
```

Recommandé : connexion SSH par clé uniquement, mises à jour de sécurité
automatiques (`unattended-upgrades`).

## 3. Nom de domaine et HTTPS

1. Acheter le nom de domaine (bureau d'enregistrement au choix).
2. Dans la zone DNS, créer :
   - un enregistrement **A** `@` → adresse IPv4 du serveur (et **AAAA** si IPv6) ;
   - un enregistrement **A** `www` → même adresse (redirigé automatiquement vers le domaine principal).
3. Attendre la propagation (quelques minutes à quelques heures) :
   `dig +short votre-domaine.com` doit renvoyer l'adresse du serveur.
4. **HTTPS est automatique** : au démarrage, Caddy obtient et renouvelle le
   certificat Let's Encrypt. Les ports 80 et 443 doivent être ouverts.

## 4. Première installation

```bash
git clone <adresse-du-dépôt> complexe-hotelier
cd complexe-hotelier/deploy
cp .env.example .env
nano .env        # DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, APP_SECRET (commandes de génération dans le fichier)
chmod 600 .env

docker compose build                       # construit l'image (quelques minutes)
docker compose --profile tools run --rm tools          # applique les migrations
docker compose up -d                       # démarre base, site et HTTPS
docker compose ps                          # « healthy » attendu pour db et app
curl https://votre-domaine.com/api/health  # {"status":"ok",…}
```

### Premier compte administrateur

```bash
docker compose --profile tools run --rm tools \
  npm run admin:create -- --email=direction@votre-domaine.com --name="Prénom Nom"
```

Le mot de passe provisoire s'affiche **une seule fois** : le transmettre de
façon sûre ; il devra être changé à la première connexion sur
`https://votre-domaine.com/admin`. Les autres comptes se créent ensuite
depuis **Administration → Utilisateurs** (un compte par personne).

### Courriels (facultatif mais recommandé)

Renseigner `EMAIL_PROVIDER=smtp` et les variables `SMTP_*`, `EMAIL_FROM`,
`NOTIFY_EMAIL` dans `deploy/.env`, puis `docker compose up -d app`.
Configurer SPF/DKIM du domaine chez le fournisseur d'envoi pour éviter les
courriers indésirables. Sans SMTP, les demandes restent consultables dans
l'administration.

## 5. Passage en production

Le site reste en `APP_MODE=demo` (bandeau visible, non indexé) tant que la
liste de [MISE-EN-PRODUCTION.md](MISE-EN-PRODUCTION.md) n'est pas complète.
Ensuite :

```bash
cd deploy
./backup.sh                                # sauvegarde de sécurité
nano .env                                  # APP_MODE=production ; PAYMENT_PROVIDER=none (ou prestataire réel)
docker compose up -d app
curl https://votre-domaine.com/api/health
```

L'application **refuse de démarrer** si la configuration est dangereuse
(paiement de démonstration en production, secret d'exemple…) : consulter
`docker compose logs app`.

Si des chambres fictives avaient été créées pour tester, elles sont
automatiquement masquées en production ; les supprimer avant le passage :
`docker compose --profile tools run --rm tools npm run db:seed-demo -- --remove`.

Enfin, déclarer le site dans Google Search Console (fichier `sitemap.xml`
généré automatiquement) et créer/mettre à jour la fiche Google Business
Profile de l'établissement avec les mêmes coordonnées que le site.

## 6. Mettre à jour le site

```bash
cd complexe-hotelier
git pull
cd deploy
./backup.sh                                          # toujours avant une mise à jour
export APP_VERSION=$(git rev-parse --short HEAD)     # étiquette de version
docker compose build
docker compose --profile tools run --rm tools        # nouvelles migrations éventuelles
docker compose up -d app
curl https://votre-domaine.com/api/health
```

Noter l'étiquette (`APP_VERSION`) de chaque mise en ligne : c'est elle qui
permet le retour arrière. Les images précédentes restent sur le serveur
(`docker images complexe-hotelier`) ; supprimer de temps en temps les plus
anciennes avec `docker image prune`.

## 7. Retour à une version précédente

**Cas 1 — la nouvelle version n'a pas ajouté de migration** (le plus courant) :

```bash
cd deploy
APP_VERSION=<étiquette-précédente> docker compose up -d app
curl https://votre-domaine.com/api/health
```

**Cas 2 — la nouvelle version a appliqué une migration** : les migrations ne
sont pas annulables automatiquement. Deux options :

- corriger rapidement par une nouvelle version (préféré si le problème est mineur) ;
- ou restaurer la sauvegarde faite juste avant la mise à jour puis relancer
  l'ancienne image :

  ```bash
  ./restore.sh ../backups/db-AAAAMMJJ-HHMMSS.dump ../backups/uploads-AAAAMMJJ-HHMMSS.tar.gz
  APP_VERSION=<étiquette-précédente> docker compose up -d app
  ```

  ⚠ Les demandes reçues entre la sauvegarde et la restauration sont alors
  perdues : les relever dans l'administration avant de restaurer.

Pour revenir au code précédent dans le dépôt : `git checkout <commit>`.

## 8. Installation sans Docker (alternative)

Sur un serveur avec Node.js 22 et PostgreSQL 16 :

```bash
npm ci && npm run build
cp .env.example .env    # compléter ; APP_MODE, DATABASE_URL, APP_SECRET, SITE_URL, TRUST_PROXY=true
npm run db:migrate
npm start               # port 3000, à placer derrière Nginx ou Caddy pour HTTPS
```

Lancer le processus avec un gestionnaire de services (systemd ou pm2) et
configurer le proxy pour transmettre `X-Forwarded-For` et ne pas mettre en
mémoire tampon les réponses (affichage progressif).

Note : en mode production, l'en-tête de sécurité impose le chargement des
ressources en HTTPS. Pour un test en HTTP sur un réseau local, utiliser
`npm run dev` ou passer par `localhost`.
