-- =====================================================================
-- 0001_schema.sql — Schéma initial du complexe hôtelier
-- PostgreSQL 14+ requis (testé sur 16).
-- Principes :
--   * statuts explicites (CHECK) et séparés : devis ≠ réservation de salle
--     ≠ réservation de chambre ≠ paiement ;
--   * doubles réservations rendues impossibles par contraintes d'exclusion ;
--   * pas de suppression des données de traçabilité (triggers) ;
--   * aucune donnée de carte bancaire n'est jamais stockée.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist; -- contraintes d'exclusion mixtes

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Suppression interdite sur % (traçabilité). Utilisez un statut d''annulation.', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La table % est en ajout seul.', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Utilisateurs, sessions, limitation de débit
-- Les rôles sont des valeurs fixes ; la matrice des permissions est
-- définie dans le code (src/server/auth/permissions.ts) et testée.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  full_name            text NOT NULL,
  password_hash        text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('admin','commercial','reception','comptabilite')),
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format CHECK (position('@' in email) > 1)
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id          text PRIMARY KEY,                 -- SHA-256 du jeton (le jeton brut n'est jamais stocké)
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ip_hash     text,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE rate_limit_events (
  id         bigserial PRIMARY KEY,
  bucket     text NOT NULL,                     -- ex. 'login', 'quote_form'
  key        text NOT NULL,                     -- identifiant haché (IP, e-mail…)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_lookup_idx ON rate_limit_events (bucket, key, created_at);

-- ---------------------------------------------------------------------
-- Clients et prospects
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  organization   text,
  email          text,
  phone          text,
  notes          text,
  anonymized_at  timestamptz,                   -- droit à l'effacement : anonymisation plutôt que suppression
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_contact_present CHECK (anonymized_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX customers_email_idx ON customers (lower(email));
CREATE INDEX customers_phone_idx ON customers (phone);
CREATE TRIGGER customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Salles événementielles
-- ---------------------------------------------------------------------
CREATE TABLE venues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name               text NOT NULL,
  short_description  text NOT NULL DEFAULT '',
  description        text NOT NULL DEFAULT '',
  area_m2            numeric(8,2) CHECK (area_m2 IS NULL OR area_m2 > 0),  -- NULL = non confirmée, non affichée
  equipment          text[] NOT NULL DEFAULT '{}',
  included_services  text[] NOT NULL DEFAULT '{}',
  optional_services  text[] NOT NULL DEFAULT '{}',
  booking_conditions text NOT NULL DEFAULT '',
  pricing_mode       text NOT NULL DEFAULT 'on_request' CHECK (pricing_mode IN ('on_request','published')),
  price_amount       numeric(12,2) CHECK (price_amount IS NULL OR price_amount > 0),
  price_unit         text,                      -- ex. « par journée »
  is_published       boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  is_demo            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_price_consistency CHECK (
    pricing_mode = 'on_request' OR (price_amount IS NOT NULL AND price_unit IS NOT NULL)
  )
);
CREATE TRIGGER venues_updated BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE venue_capacities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  layout        text NOT NULL CHECK (layout IN ('theatre','classroom','u_shape','banquet','cocktail','boardroom','other')),
  label         text,                           -- précision si layout = 'other'
  capacity      integer NOT NULL CHECK (capacity > 0),
  is_validated  boolean NOT NULL DEFAULT false, -- seules les capacités validées sont publiées
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, layout, label)
);

-- ---------------------------------------------------------------------
-- Hébergement : catégories de chambres, chambres physiques, tarifs
-- ---------------------------------------------------------------------
CREATE TABLE room_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text NOT NULL,
  description         text NOT NULL DEFAULT '',
  max_adults          integer NOT NULL CHECK (max_adults > 0),
  max_children        integer NOT NULL DEFAULT 0 CHECK (max_children >= 0),
  max_occupancy       integer NOT NULL CHECK (max_occupancy > 0),
  bed_count           integer NOT NULL CHECK (bed_count > 0),
  bed_description     text NOT NULL DEFAULT '',
  amenities           text[] NOT NULL DEFAULT '{}',
  stay_rules          text NOT NULL DEFAULT '',
  cancellation_policy text NOT NULL DEFAULT '',
  is_published        boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  is_demo             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_types_occupancy CHECK (max_occupancy <= max_adults + max_children)
);
CREATE TRIGGER room_types_updated BEFORE UPDATE ON room_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE rooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,      -- identifiant interne (ex. numéro de porte)
  room_type_id       uuid NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  operational_status text NOT NULL DEFAULT 'planned'
                     CHECK (operational_status IN ('planned','under_works','ready','in_service','out_of_service')),
  notes              text,
  is_demo            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_type_idx ON rooms (room_type_id);
CREATE TRIGGER rooms_updated BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tarifs par nuit. Une nuit sans tarif n'est pas vendable : les périodes
-- tarifaires définissent donc aussi la fenêtre de commercialisation.
CREATE TABLE room_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id   uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  starts_on      date NOT NULL,
  ends_on        date NOT NULL,                 -- exclusive (nuit du ends_on non incluse)
  nightly_amount numeric(12,2) NOT NULL CHECK (nightly_amount > 0),
  currency       char(3) NOT NULL,
  label          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on),
  CONSTRAINT room_rates_no_overlap EXCLUDE USING gist (
    room_type_id WITH =, daterange(starts_on, ends_on, '[)') WITH &&
  )
);

-- ---------------------------------------------------------------------
-- Médias
-- ---------------------------------------------------------------------
CREATE TABLE media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path      text NOT NULL,                 -- chemin relatif dans UPLOAD_DIR, ou /placeholders/…
  alt            text NOT NULL CHECK (length(trim(alt)) > 0),
  caption        text,
  category       text NOT NULL CHECK (category IN ('etablissement','salles','chambres','services','evenements','autre')),
  venue_id       uuid REFERENCES venues(id) ON DELETE SET NULL,
  room_type_id   uuid REFERENCES room_types(id) ON DELETE SET NULL,
  is_placeholder boolean NOT NULL DEFAULT false, -- image provisoire, signalée comme telle sur le site
  is_published   boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  width          integer,
  height         integer,
  uploaded_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_category_idx ON media (category, is_published, sort_order);
CREATE INDEX media_venue_idx ON media (venue_id);
CREATE INDEX media_room_type_idx ON media (room_type_id);

-- ---------------------------------------------------------------------
-- Demandes commerciales (devis / disponibilité) et messages de contact
-- Une demande de devis n'est JAMAIS une réservation.
-- ---------------------------------------------------------------------
CREATE TABLE quote_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference            text NOT NULL UNIQUE,
  request_type         text NOT NULL DEFAULT 'quote' CHECK (request_type IN ('quote','availability')),
  customer_id          uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  venue_id             uuid REFERENCES venues(id) ON DELETE SET NULL, -- NULL = recommandation souhaitée
  event_type           text NOT NULL,
  event_date           date NOT NULL,
  start_time           time,
  end_time             time,
  participants         integer NOT NULL CHECK (participants > 0),
  layout               text,
  equipment_needs      text[] NOT NULL DEFAULT '{}',
  catering_needs       text,
  budget               text,
  message              text,
  status               text NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','to_process','preparing','sent','negotiation','accepted','refused','cancelled')),
  quoted_amount        numeric(12,2) CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
  quoted_currency      char(3),
  quote_sent_at        timestamptz,
  follow_up_on         date,
  assigned_to          uuid REFERENCES users(id) ON DELETE SET NULL,
  source               text NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','phone','email','walk_in','other')),
  privacy_accepted_at  timestamptz,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time),
  -- une demande issue du site doit porter le consentement
  CHECK (source <> 'website' OR privacy_accepted_at IS NOT NULL),
  CHECK (quoted_amount IS NULL OR quoted_currency IS NOT NULL)
);
CREATE INDEX quote_requests_status_idx ON quote_requests (status, created_at DESC);
CREATE INDEX quote_requests_event_date_idx ON quote_requests (event_date);
CREATE INDEX quote_requests_follow_up_idx ON quote_requests (follow_up_on) WHERE follow_up_on IS NOT NULL;
CREATE TRIGGER quote_requests_updated BEFORE UPDATE ON quote_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER quote_requests_no_delete BEFORE DELETE ON quote_requests FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE TABLE quote_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  kind        text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','follow_up','status_change')),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_notes_quote_idx ON quote_notes (quote_id, created_at);

CREATE TABLE contact_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           text NOT NULL,
  email               text,
  phone               text,
  topic               text NOT NULL CHECK (topic IN ('general','salles','hebergement','evenement','autre')),
  message             text NOT NULL,
  status              text NOT NULL DEFAULT 'new' CHECK (status IN ('new','handled','archived')),
  privacy_accepted_at timestamptz NOT NULL,
  handled_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  handled_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX contact_messages_status_idx ON contact_messages (status, created_at DESC);

-- ---------------------------------------------------------------------
-- Occupation des salles : réservations, options et blocages
-- Une seule table pour que la contrainte d'exclusion couvre à la fois les
-- réservations clients et les blocages internes (maintenance…).
-- ---------------------------------------------------------------------
CREATE TABLE venue_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL UNIQUE,
  kind           text NOT NULL DEFAULT 'booking' CHECK (kind IN ('booking','block')),
  venue_id       uuid NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  customer_id    uuid REFERENCES customers(id) ON DELETE RESTRICT,
  quote_id       uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  title          text NOT NULL,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  status         text NOT NULL
                 CHECK (status IN ('option','confirmed','completed','cancelled')),
  block_reason   text CHECK (block_reason IS NULL OR block_reason IN ('maintenance','internal','works','other')),
  amount         numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
  currency       char(3),
  option_expires_on date,
  notes          text,
  confirmed_at   timestamptz,
  confirmed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (kind = 'block' OR customer_id IS NOT NULL),
  CHECK (kind = 'booking' OR block_reason IS NOT NULL),
  CHECK (kind = 'booking' OR status IN ('confirmed','cancelled')),
  CHECK (status <> 'confirmed' OR kind = 'block' OR confirmed_at IS NOT NULL),
  CHECK (amount IS NULL OR currency IS NOT NULL),
  -- Anti-chevauchement : une option ou une réservation confirmée (ou un
  -- blocage actif) occupe la salle de façon exclusive.
  CONSTRAINT venue_bookings_no_overlap EXCLUDE USING gist (
    venue_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('option','confirmed'))
);
CREATE INDEX venue_bookings_range_idx ON venue_bookings (venue_id, starts_at);
CREATE INDEX venue_bookings_status_idx ON venue_bookings (status, starts_at);
CREATE TRIGGER venue_bookings_updated BEFORE UPDATE ON venue_bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER venue_bookings_no_delete BEFORE DELETE ON venue_bookings FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- ---------------------------------------------------------------------
-- Réservations de chambres
-- room_reservations = la réservation du client ;
-- room_reservation_units = l'occupation effective de chaque chambre
-- physique (avec contrainte d'exclusion). Un blocage (maintenance) est une
-- unité sans réservation.
-- ---------------------------------------------------------------------
CREATE TABLE room_reservations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          text NOT NULL UNIQUE,
  customer_id        uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  room_type_id       uuid NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  check_in           date NOT NULL,
  check_out          date NOT NULL,
  adults             integer NOT NULL CHECK (adults > 0),
  children           integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  rooms_count        integer NOT NULL CHECK (rooms_count > 0),
  status             text NOT NULL
                     CHECK (status IN ('pending_payment','pending_confirmation','confirmed','checked_in','checked_out','cancelled','expired','no_show')),
  total_amount       numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  currency           char(3) NOT NULL,
  hold_expires_at    timestamptz,                -- délai de paiement avant libération
  terms_accepted_at  timestamptz NOT NULL,
  special_requests   text,
  access_token_hash  text NOT NULL,             -- accès client au récapitulatif (jeton dans le lien, haché ici)
  needs_review       boolean NOT NULL DEFAULT false, -- ex. paiement reçu après expiration : vérification humaine
  is_demo            boolean NOT NULL DEFAULT false,
  confirmed_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL)
);
CREATE INDEX room_reservations_status_idx ON room_reservations (status, check_in);
CREATE INDEX room_reservations_hold_idx ON room_reservations (hold_expires_at) WHERE status = 'pending_payment';
CREATE TRIGGER room_reservations_updated BEFORE UPDATE ON room_reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER room_reservations_no_delete BEFORE DELETE ON room_reservations FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE TABLE room_reservation_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES room_reservations(id) ON DELETE RESTRICT,
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  kind            text NOT NULL DEFAULT 'reservation' CHECK (kind IN ('reservation','block')),
  block_reason    text,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CHECK ((kind = 'reservation') = (reservation_id IS NOT NULL)),
  CHECK (kind = 'reservation' OR block_reason IS NOT NULL),
  CONSTRAINT room_units_no_overlap EXCLUDE USING gist (
    room_id WITH =, daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (is_active)
);
CREATE INDEX room_units_reservation_idx ON room_reservation_units (reservation_id);
CREATE TRIGGER room_units_no_delete BEFORE DELETE ON room_reservation_units FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- ---------------------------------------------------------------------
-- Facturation
-- Numérotation continue par année, attribuée à l'émission sous verrou.
-- ---------------------------------------------------------------------
CREATE TABLE invoice_counters (
  year        integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

CREATE TABLE invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number               text UNIQUE,              -- attribué à l'émission uniquement
  fiscal_year          integer,
  sequence_number      integer,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  customer_id          uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  venue_booking_id     uuid REFERENCES venue_bookings(id) ON DELETE RESTRICT,
  room_reservation_id  uuid REFERENCES room_reservations(id) ON DELETE RESTRICT,
  currency             char(3) NOT NULL,
  total_amount         numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  issued_at            timestamptz,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year, sequence_number),
  CHECK (status = 'draft' OR (number IS NOT NULL AND issued_at IS NOT NULL))
);
CREATE TRIGGER invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE TABLE invoice_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  label        text NOT NULL,
  quantity     numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_amount  numeric(12,2) NOT NULL CHECK (unit_amount >= 0),
  position     integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- Paiements
-- Statut « succeeded » uniquement sur confirmation serveur (webhook
-- authentifié ou saisie manuelle tracée par un utilisateur habilité).
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference            text NOT NULL UNIQUE,     -- notre référence de transaction
  provider             text NOT NULL,            -- 'manual', 'demo', ou identifiant du prestataire
  provider_reference   text,
  room_reservation_id  uuid REFERENCES room_reservations(id) ON DELETE RESTRICT,
  venue_booking_id     uuid REFERENCES venue_bookings(id) ON DELETE RESTRICT,
  invoice_id           uuid REFERENCES invoices(id) ON DELETE RESTRICT,
  amount               numeric(12,2) NOT NULL CHECK (amount > 0),
  currency             char(3) NOT NULL,
  method               text NOT NULL CHECK (method IN ('card','mobile_money','bank_transfer','cash','cheque','other')),
  payment_type         text NOT NULL DEFAULT 'full' CHECK (payment_type IN ('deposit','balance','full','refund')),
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','cancelled','refunded')),
  is_demo              boolean NOT NULL DEFAULT false,
  failure_reason       text,
  recorded_by          uuid REFERENCES users(id) ON DELETE SET NULL, -- saisie manuelle
  created_at           timestamptz NOT NULL DEFAULT now(),
  confirmed_at         timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reference),
  CHECK (num_nonnulls(room_reservation_id, venue_booking_id, invoice_id) >= 1),
  CHECK (status <> 'succeeded' OR confirmed_at IS NOT NULL),
  CHECK (provider <> 'manual' OR recorded_by IS NOT NULL)
);
CREATE INDEX payments_status_idx ON payments (status, created_at DESC);
CREATE INDEX payments_room_res_idx ON payments (room_reservation_id);
CREATE INDEX payments_venue_booking_idx ON payments (venue_booking_id);
CREATE TRIGGER payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- Notifications reçues des prestataires : l'unicité (provider, event_id)
-- garantit qu'une notification répétée n'est traitée qu'une seule fois.
CREATE TABLE payment_events (
  id            bigserial PRIMARY KEY,
  provider      text NOT NULL,
  event_id      text NOT NULL,
  payment_id    uuid REFERENCES payments(id) ON DELETE RESTRICT,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  outcome       text,
  received_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- ---------------------------------------------------------------------
-- Services, contenus, paramètres, FAQ
-- ---------------------------------------------------------------------
CREATE TABLE services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  icon          text NOT NULL DEFAULT 'star',
  status        text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','available','suspended')),
  is_published  boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  updated_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Paramètres de l'établissement (coordonnées, interrupteurs…).
-- Valeur vide = « À renseigner » : l'élément correspondant est masqué.
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Blocs de texte éditables (pages, pages juridiques). locale prévue pour
-- une seconde langue ultérieure.
CREATE TABLE content_blocks (
  key         text NOT NULL,
  locale      text NOT NULL DEFAULT 'fr',
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale)
);

CREATE TABLE faqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale        text NOT NULL DEFAULT 'fr',
  category      text NOT NULL DEFAULT 'general' CHECK (category IN ('general','salles','hebergement','paiement')),
  question      text NOT NULL,
  answer        text NOT NULL,
  is_published  boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER faqs_updated BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Journal des opérations (ajout seul)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Séquence pour les références lisibles (DV-2026-00001, RS-…, RC-…, PY-…)
CREATE SEQUENCE reference_seq START 1;
