-- =====================================================================
-- 0002_reference_data.sql — Données de référence (PAS des données de démo)
-- Tout ce qui n'est pas confirmé reste vide : l'interface affiche alors
-- « À renseigner » dans l'administration et masque l'élément sur le site.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paramètres de l'établissement (tous vides = non confirmés)
-- ---------------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('establishment.name', ''),
  ('establishment.tagline', ''),
  ('establishment.logo_path', ''),
  -- Fuseau horaire IANA de l'établissement (ex. Africa/Abidjan). Vide = UTC.
  ('establishment.timezone', ''),
  ('contact.phone', ''),
  ('contact.whatsapp', ''),
  ('contact.email', ''),
  ('address.street', ''),
  ('address.city', ''),
  ('address.region', ''),
  ('address.country', ''),
  ('address.directions', ''),
  ('geo.latitude', ''),
  ('geo.longitude', ''),
  ('geo.verified', 'false'),
  ('hours.reception', ''),
  ('legal.company_name', ''),
  ('legal.legal_form', ''),
  ('legal.registration_number', ''),
  ('legal.tax_id', ''),
  ('legal.publication_director', ''),
  ('legal.hosting_provider', ''),
  ('legal.validated', 'false'),
  ('commerce.currency', ''),
  ('commerce.payment_methods', ''),
  ('social.facebook', ''),
  ('social.instagram', ''),
  ('social.linkedin', ''),
  -- Hébergement : statut public et interrupteur de réservation en ligne
  ('rooms.public_status', 'coming_soon'),        -- coming_soon | to_confirm | open
  ('rooms.booking_enabled', 'false'),
  ('rooms.payment_mode', 'on_confirmation'),     -- on_confirmation (sans paiement en ligne) | online
  ('rooms.hold_minutes', '30'),
  ('rooms.max_rooms_per_booking', '3'),
  ('analytics.enabled', 'false');

-- ---------------------------------------------------------------------
-- Les deux salles existantes — noms PROVISOIRES, sans superficie, sans
-- capacité, sans tarif (« sur devis ») tant que non validés.
-- ---------------------------------------------------------------------
INSERT INTO venues (slug, name, short_description, description, booking_conditions, pricing_mode, sort_order) VALUES
  ('salle-1', 'Salle 1 (nom provisoire)',
   $t$Un espace événementiel pour vos conférences, formations, séminaires, réunions et cérémonies.$t$,
   $t$Cette salle accueille des événements professionnels et privés : conférences, formations, séminaires, réunions ou cérémonies. Sa description détaillée, ses dimensions et ses capacités seront publiées dès leur validation par la direction. En attendant, notre équipe répond à chaque demande et vous aide à vérifier que l'espace convient à votre projet.$t$,
   $t$Les conditions de réservation sont communiquées avec le devis. Une date n'est réservée qu'après confirmation écrite de l'établissement.$t$,
   'on_request', 1),
  ('salle-2', 'Salle 2 (nom provisoire)',
   $t$Un second espace pour organiser vos événements professionnels et privés.$t$,
   $t$Cette seconde salle complète l'offre événementielle de l'établissement. Elle peut convenir à des réunions, formations, séminaires ou cérémonies, selon les capacités qui seront confirmées. Contactez-nous pour connaître ses caractéristiques et recevoir une proposition adaptée.$t$,
   $t$Les conditions de réservation sont communiquées avec le devis. Une date n'est réservée qu'après confirmation écrite de l'établissement.$t$,
   'on_request', 2);

-- Visuels provisoires (illustrations neutres, signalées comme telles)
INSERT INTO media (file_path, alt, category, venue_id, is_placeholder, sort_order)
SELECT '/placeholders/salle-1.svg', 'Image provisoire — photographie de la salle 1 à venir', 'salles', id, true, 1
  FROM venues WHERE slug = 'salle-1';
INSERT INTO media (file_path, alt, category, venue_id, is_placeholder, sort_order)
SELECT '/placeholders/salle-2.svg', 'Image provisoire — photographie de la salle 2 à venir', 'salles', id, true, 1
  FROM venues WHERE slug = 'salle-2';
INSERT INTO media (file_path, alt, category, is_placeholder, sort_order) VALUES
  ('/placeholders/facade.svg', 'Image provisoire — photographie de l''établissement à venir', 'etablissement', true, 0);

-- ---------------------------------------------------------------------
-- Catalogue de services : TOUS « envisagés » et NON publiés.
-- La direction les active un par un dans l'administration.
-- ---------------------------------------------------------------------
INSERT INTO services (slug, name, description, icon, status, is_published, sort_order) VALUES
  ('restauration-traiteur', 'Restauration et service traiteur', $t$Pauses-café, déjeuners et réceptions pour vos événements.$t$, 'utensils', 'planned', false, 1),
  ('petit-dejeuner', 'Petit-déjeuner', $t$Petit-déjeuner servi aux clients de l'hôtel.$t$, 'coffee', 'planned', false, 2),
  ('wifi', 'Connexion Wi-Fi', $t$Accès à internet sans fil dans les espaces concernés.$t$, 'wifi', 'planned', false, 3),
  ('parking', 'Parking', $t$Stationnement pour les clients et les participants.$t$, 'car', 'planned', false, 4),
  ('transport', 'Transport et navettes', $t$Organisation de déplacements sur demande.$t$, 'bus', 'planned', false, 5),
  ('equipement-audiovisuel', 'Équipement audiovisuel', $t$Vidéoprojection, sonorisation et microphones pour vos présentations.$t$, 'projector', 'planned', false, 6),
  ('bien-etre', 'Bien-être', $t$Espace de détente et de soins.$t$, 'leaf', 'planned', false, 7),
  ('salon-beaute', 'Salon de beauté', $t$Coiffure et soins esthétiques.$t$, 'sparkles', 'planned', false, 8),
  ('studio-photo-video', 'Studio photo et vidéo', $t$Espace de prise de vue pour particuliers et professionnels.$t$, 'camera', 'planned', false, 9),
  ('centre-formation', 'Centre de formation', $t$Salles et accompagnement pour vos sessions de formation.$t$, 'book', 'planned', false, 10),
  ('boutique', 'Boutique', $t$Produits et souvenirs.$t$, 'bag', 'planned', false, 11);

-- ---------------------------------------------------------------------
-- Blocs de contenu éditables
-- Format des listes : une ligne par élément, « Titre | Texte ».
-- ---------------------------------------------------------------------
INSERT INTO content_blocks (key, title, body) VALUES
  ('home.hero', $t$Un lieu pour vos événements, bientôt pour vos séjours$t$,
   $t$Conférences, formations, séminaires, réunions ou cérémonies : découvrez nos deux salles événementielles et demandez un devis adapté à votre projet. L'hébergement ouvrira progressivement.$t$),
  ('home.venues_intro', $t$Deux salles pour vos événements$t$,
   $t$Deux espaces distincts, sur un même site, pour accueillir vos rencontres professionnelles et vos moments importants.$t$),
  ('home.lodging', $t$L'hébergement se prépare$t$,
   $t$Les chambres de l'hôtel sont en cours d'aménagement. Leurs caractéristiques, tarifs et dates d'ouverture seront publiés dès qu'ils seront confirmés.$t$),
  ('home.strengths', $t$Pourquoi organiser votre événement ici$t$,
   $t$Deux salles distinctes | Deux espaces événementiels sur un même site, pour des conférences, formations, séminaires, réunions ou cérémonies.
Une réponse personnalisée | Chaque demande est étudiée par notre équipe, qui vous adresse une proposition adaptée à votre événement.
Un établissement qui grandit | L'hébergement et de nouveaux services ouvriront progressivement, annoncés ici dès leur confirmation.$t$),
  ('home.contact', $t$Parlons de votre projet$t$,
   $t$Une date, un nombre de participants, un type d'événement : quelques informations suffisent pour que notre équipe vous recontacte.$t$),
  ('hotel.presentation', $t$L'établissement$t$,
   $t$Notre complexe réunit, sur un même site, des espaces événementiels et un hôtel en cours d'aménagement. Les deux salles accueillent dès à présent conférences, formations, séminaires, réunions et cérémonies.

Les travaux se poursuivent pour ouvrir progressivement l'hébergement puis, le cas échéant, de nouveaux services. Nous annoncerons chaque ouverture sur ce site lorsqu'elle sera confirmée.$t$),
  ('hotel.vision', $t$Notre vision$t$,
   $t$Offrir un lieu fonctionnel et chaleureux, où les organisations comme les familles peuvent se réunir, travailler et célébrer dans de bonnes conditions.$t$),
  ('hotel.welcome', $t$Notre accueil$t$,
   $t$Nous prenons le temps de comprendre chaque projet avant de proposer une solution. Écrivez-nous ou appelez-nous : nous vous répondrons personnellement.$t$),
  ('salles.intro', $t$Salles événementielles$t$,
   $t$Présentez votre événement, nous vous aidons à choisir la salle et la configuration adaptées. Les tarifs sont établis sur devis selon la date, la durée et les services souhaités.$t$),
  ('hebergement.intro', $t$Chambres et hébergement$t$,
   $t$Les chambres de l'hôtel sont en préparation. Cette page présentera leurs caractéristiques, leurs tarifs et leurs disponibilités dès leur confirmation.$t$),
  ('services.intro', $t$Services$t$,
   $t$Les services proposés sur place sont présentés ici au fur et à mesure de leur ouverture effective.$t$),
  ('contact.practical', $t$Informations pratiques$t$, ''),
  ('legal.mentions', $t$Mentions légales$t$,
   $t$⚠ MODÈLE À COMPLÉTER ET À FAIRE VALIDER par un professionnel du droit du pays de l'établissement. Ce texte générique ne garantit aucune conformité.

Éditeur du site
Raison sociale : [À RENSEIGNER]
Forme juridique : [À RENSEIGNER]
Numéro d'immatriculation (registre du commerce ou équivalent) : [À RENSEIGNER]
Identifiant fiscal : [À RENSEIGNER]
Adresse du siège : [À RENSEIGNER]
Téléphone et courriel : [À RENSEIGNER]
Directeur de la publication : [À RENSEIGNER]

Hébergement du site
Hébergeur : [À RENSEIGNER — nom, adresse et contact de l'hébergeur]

Propriété intellectuelle
Les textes, photographies et éléments graphiques de ce site appartiennent à l'éditeur ou sont utilisés avec autorisation. Toute reproduction sans accord préalable est interdite.

Responsabilité
Les informations publiées sont fournies à titre indicatif et peuvent évoluer. Seules les confirmations écrites de l'établissement engagent celui-ci.$t$),
  ('legal.privacy', $t$Politique de confidentialité$t$,
   $t$⚠ MODÈLE À COMPLÉTER ET À FAIRE VALIDER selon la législation sur la protection des données personnelles applicable dans le pays de l'établissement (et, le cas échéant, l'autorité de contrôle compétente). Ce texte générique ne garantit aucune conformité.

Responsable du traitement : [À RENSEIGNER]
Contact pour toute question relative à vos données : [À RENSEIGNER]

Données collectées
Lorsque vous utilisez nos formulaires, nous collectons uniquement les informations nécessaires au traitement de votre demande : nom, coordonnées (téléphone et/ou courriel), organisation le cas échéant, et les détails de votre événement ou de votre séjour.

Finalités
Répondre à vos demandes de devis, de disponibilité ou d'information ; gérer vos réservations ; respecter nos obligations comptables et légales.

Base légale : [À RENSEIGNER selon la loi applicable — consentement, exécution de mesures précontractuelles, obligation légale].

Destinataires
Les membres habilités de notre équipe. Vos données ne sont ni vendues ni louées. Prestataires techniques (hébergement, envoi de courriels, paiement) : [À RENSEIGNER].

Durées de conservation
Demandes sans suite : [À RENSEIGNER — durée proposée : 3 ans après le dernier contact]. Données de réservation et de facturation : durée imposée par la réglementation comptable [À RENSEIGNER].

Vos droits
Vous pouvez demander l'accès, la rectification ou l'effacement de vos données, et vous opposer à leur traitement, en écrivant à : [À RENSEIGNER].

Sécurité
Les données sont stockées sur des serveurs sécurisés ; l'accès à l'administration est réservé aux personnes habilitées. Aucune donnée de carte bancaire n'est stockée sur ce site.

Cookies
Ce site utilise uniquement un cookie technique de session pour l'espace d'administration. Aucun outil de mesure d'audience ni cookie publicitaire n'est activé à ce jour.$t$),
  ('legal.cookies', $t$Gestion des cookies$t$,
   $t$⚠ MODÈLE À FAIRE VALIDER.

À ce jour, ce site n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Seul un cookie strictement nécessaire est déposé lorsqu'un membre de l'équipe se connecte à l'espace d'administration.

Si un outil de mesure d'audience est ajouté ultérieurement, cette page sera mise à jour et votre consentement sera demandé lorsque la réglementation applicable l'exige.$t$),
  ('legal.booking_terms', $t$Conditions générales de réservation$t$,
   $t$⚠ MODÈLE À COMPLÉTER ET À FAIRE VALIDER. Les conditions définitives seront fixées par la direction.

1. Objet : [À RENSEIGNER]
2. Demande et confirmation : une demande envoyée via le site ne constitue pas une réservation. La réservation n'est ferme qu'après confirmation écrite de l'établissement [et réception de l'acompte éventuel — À RENSEIGNER].
3. Tarifs et devise : [À RENSEIGNER]
4. Modalités de paiement : [À RENSEIGNER]
5. Arrivée et départ (hébergement) : [À RENSEIGNER]
6. Responsabilités : [À RENSEIGNER]
7. Litiges et droit applicable : [À RENSEIGNER]$t$),
  ('legal.cancellation', $t$Conditions d'annulation$t$,
   $t$⚠ MODÈLE À COMPLÉTER ET À FAIRE VALIDER.

Annulation par le client : [À RENSEIGNER — délais et frais éventuels]
Modification de date : [À RENSEIGNER]
Non-présentation : [À RENSEIGNER]
Annulation par l'établissement : [À RENSEIGNER]
Remboursements : [À RENSEIGNER — délais et moyens]$t$),
  ('legal.venue_rental', $t$Conditions de location des salles$t$,
   $t$⚠ MODÈLE À COMPLÉTER ET À FAIRE VALIDER.

1. Devis et réservation : la demande de devis n'engage ni le client ni l'établissement. La date est réservée uniquement après acceptation du devis et confirmation écrite [et versement de l'acompte prévu — À RENSEIGNER].
2. Option : une date peut être placée en option pendant une durée limitée [À RENSEIGNER], sans garantie au-delà.
3. Horaires d'accès, installation et rangement : [À RENSEIGNER]
4. Capacité maximale et sécurité : le client s'engage à respecter la capacité indiquée pour la configuration choisie [À RENSEIGNER].
5. Matériel et dégradations : [À RENSEIGNER — caution éventuelle]
6. Restauration extérieure : [À RENSEIGNER]
7. Bruit, décoration, affichage : [À RENSEIGNER]
8. Annulation : voir les conditions d'annulation.$t$);
