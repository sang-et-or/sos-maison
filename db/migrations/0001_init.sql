-- SOS Maison — schéma initial PostgreSQL (16+)
-- Exécuté une seule fois par scripts/migrate.ts (table schema_migrations).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('user', 'pro', 'admin');
CREATE TYPE repair_status    AS ENUM ('open', 'resolved', 'needs_pro', 'abandoned');
CREATE TYPE message_role     AS ENUM ('user', 'assistant', 'system');
CREATE TYPE attachment_kind  AS ENUM ('photo', 'video_frame', 'audio');
CREATE TYPE usage_kind       AS ENUM ('message', 'photo', 'search', 'voice_minute', 'video_minute', 'classifier');
CREATE TYPE sub_status       AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE sub_plan         AS ENUM ('monthly', 'yearly');
CREATE TYPE request_status   AS ENUM ('sent', 'seen', 'accepted', 'declined', 'done');
CREATE TYPE pro_status       AS ENUM ('pending', 'verified', 'suspended');

-- ---------------------------------------------------------------------------
-- Réglages modifiables depuis l'administration
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value, description) VALUES
  ('welcome_credits',      '100',  'Crédits offerts à chaque nouveau compte'),
  ('credit_cost',          '{"message":2,"photo":3,"search":3,"voice_minute":5,"video_minute":10,"classifier":0}',
                                   'Crédits consommés par action'),
  ('premium_price_cents',  '{"monthly":299,"yearly":2990}', 'Prix TTC en centimes'),
  ('premium_monthly_caps', '{"repair":20,"photo":60,"search":30,"voice_minute":20,"video_minute":10}',
                                   'Plafonds mensuels d''usage raisonnable Premium'),
  ('session_caps',         '{"voice_minutes":10,"video_minutes":5}', 'Durée maximale d''une session temps réel'),
  ('attachment_retention_days', '90', 'Conservation des photos (jours)'),
  ('credit_pack',          '{"credits":100,"price_cents":199}', 'Pack de crédits supplémentaires');

-- ---------------------------------------------------------------------------
-- Comptes et authentification (lien magique par e-mail)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL CHECK (email = lower(email) AND position('@' in email) > 1),
  role              user_role NOT NULL DEFAULT 'user',
  display_name      text,
  postal_code       text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
  credit_balance    integer NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  consent_terms_at  timestamptz,
  consent_marketing boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
-- Un seul compte actif par e-mail.
CREATE UNIQUE INDEX users_email_active ON users (email) WHERE deleted_at IS NULL;

-- Empreintes (SHA-256) des e-mails ayant déjà reçu les crédits de bienvenue.
-- Conservée après suppression du compte (intérêt légitime : prévention de la fraude).
CREATE TABLE welcome_grants (
  email_hash  text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Jeton de connexion : seul le hash SHA-256 est stocké.
CREATE TABLE login_tokens (
  token_hash  text PRIMARY KEY,
  email       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_tokens_email ON login_tokens (email, created_at DESC);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- Abonnements et crédits
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text UNIQUE,
  plan                   sub_plan NOT NULL,
  status                 sub_status NOT NULL,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user ON subscriptions (user_id);

-- Registre des crédits : on n'y fait que des INSERT.
CREATE TABLE credit_ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       integer NOT NULL CHECK (delta <> 0),
  reason      text NOT NULL,           -- welcome | usage:<kind> | pack | admin | refund
  repair_id   uuid,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_user ON credit_ledger (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Dépannages
-- ---------------------------------------------------------------------------
CREATE TABLE equipment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL,          -- lave-linge, chaudière...
  brand         text,
  model         text,
  purchased_on  date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX equipment_user ON equipment (user_id);

CREATE TABLE repairs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment_id  uuid REFERENCES equipment(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT 'Nouveau dépannage',
  status        repair_status NOT NULL DEFAULT 'open',
  risk_level    smallint NOT NULL DEFAULT 0 CHECK (risk_level BETWEEN 0 AND 4),
  pro_category  text,                   -- métier suggéré si artisan nécessaire
  keep          boolean NOT NULL DEFAULT false, -- l'utilisateur garde ce dépannage (pas d'expiration des photos)
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repairs_user ON repairs (user_id, updated_at DESC);

-- Le niveau de risque d'un dépannage ne peut jamais redescendre.
CREATE FUNCTION repairs_risk_monotonic() RETURNS trigger AS $$
BEGIN
  IF NEW.risk_level < OLD.risk_level THEN
    NEW.risk_level := OLD.risk_level;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER repairs_risk_monotonic BEFORE UPDATE ON repairs
  FOR EACH ROW EXECUTE FUNCTION repairs_risk_monotonic();

CREATE TABLE messages (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repair_id   uuid NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  role        message_role NOT NULL,
  content     text NOT NULL,
  risk_level  smallint CHECK (risk_level BETWEEN 0 AND 4),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_repair ON messages (repair_id, id);

-- Photos et captures : stockées en base (≤ 1 Mo chacune après compression côté téléphone).
CREATE TABLE attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id   uuid NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  message_id  bigint REFERENCES messages(id) ON DELETE SET NULL,
  kind        attachment_kind NOT NULL,
  mime_type   text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes       bytea NOT NULL CHECK (octet_length(bytes) <= 1048576),
  width       integer,
  height      integer,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_repair ON attachments (repair_id);
CREATE INDEX attachments_expiry ON attachments (expires_at) WHERE expires_at IS NOT NULL;

-- Liens cités : uniquement des URL renvoyées par l'API de recherche.
CREATE TABLE sources (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repair_id   uuid NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  message_id  bigint REFERENCES messages(id) ON DELETE CASCADE,
  url         text NOT NULL CHECK (url ~ '^https://'),
  title       text NOT NULL,
  provider    text NOT NULL DEFAULT 'brave',
  is_video    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_repair ON sources (repair_id);

-- Coût réel de chaque appel à un fournisseur (pilotage de la marge).
CREATE TABLE usage_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  repair_id     uuid REFERENCES repairs(id) ON DELETE SET NULL,
  kind          usage_kind NOT NULL,
  provider      text NOT NULL,          -- anthropic | google | brave
  model         text,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cached_tokens integer NOT NULL DEFAULT 0,
  quantity      numeric(10,3) NOT NULL DEFAULT 1,  -- minutes, recherches, photos
  cost_usd      numeric(12,6) NOT NULL DEFAULT 0,
  credits       integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_user_month ON usage_events (user_id, created_at);
CREATE INDEX usage_events_created ON usage_events (created_at);

-- ---------------------------------------------------------------------------
-- Annuaire d'artisans
-- ---------------------------------------------------------------------------
CREATE TABLE pro_categories (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
INSERT INTO pro_categories (slug, name, sort_order) VALUES
  ('plombier', 'Plombier', 1),
  ('electricien', 'Électricien', 2),
  ('chauffagiste', 'Chauffagiste', 3),
  ('serrurier', 'Serrurier', 4),
  ('electromenager', 'Réparateur électroménager', 5),
  ('multiservices', 'Artisan multiservices', 6);

CREATE TABLE pros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  company_name  text NOT NULL,
  siret         text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),
  description   text,
  phone         text,
  email         text,
  website       text CHECK (website IS NULL OR website ~ '^https?://'),
  city          text NOT NULL,
  postal_code   text NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  service_postal_codes text[] NOT NULL DEFAULT '{}',   -- zone d'intervention
  service_departments  text[] NOT NULL DEFAULT '{}',   -- ex. {'75','92'}
  status        pro_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pros_postal ON pros USING gin (service_postal_codes);
CREATE INDEX pros_depts  ON pros USING gin (service_departments);

CREATE TABLE pro_category_links (
  pro_id        uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  category_slug text NOT NULL REFERENCES pro_categories(slug) ON UPDATE CASCADE,
  PRIMARY KEY (pro_id, category_slug)
);

CREATE TABLE service_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  pro_id          uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  repair_id       uuid REFERENCES repairs(id) ON DELETE SET NULL,
  contact_name    text NOT NULL,
  contact_phone   text,
  contact_email   text,
  postal_code     text NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  message         text NOT NULL,
  shared_summary  text,                 -- seulement si consent_share = true
  consent_share   boolean NOT NULL DEFAULT false,
  status          request_status NOT NULL DEFAULT 'sent',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (consent_share OR shared_summary IS NULL),
  CHECK (contact_phone IS NOT NULL OR contact_email IS NOT NULL)
);
CREATE INDEX service_requests_pro ON service_requests (pro_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Contenus et audit
-- ---------------------------------------------------------------------------
CREATE TABLE content_pages (
  slug        text PRIMARY KEY,
  title       text NOT NULL,
  body_md     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid,
  action      text NOT NULL,
  target      text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Fonctions métier (atomiques, appelées par l'application)
-- ---------------------------------------------------------------------------

-- Crée ou retrouve un compte ; les crédits de bienvenue ne sont donnés qu'à la création.
CREATE FUNCTION upsert_user(p_email text) RETURNS users AS $$
DECLARE
  u users;
  welcome integer;
BEGIN
  SELECT * INTO u FROM users WHERE email = lower(p_email) AND deleted_at IS NULL;
  IF FOUND THEN
    UPDATE users SET email_verified_at = coalesce(email_verified_at, now())
      WHERE id = u.id RETURNING * INTO u;
    RETURN u;
  END IF;
  SELECT (value)::text::integer INTO welcome FROM settings WHERE key = 'welcome_credits';
  INSERT INTO welcome_grants (email_hash)
    VALUES (encode(digest(lower(p_email), 'sha256'), 'hex'))
    ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    welcome := 0;  -- e-mail déjà crédité par le passé
  END IF;
  INSERT INTO users (email, credit_balance, email_verified_at)
    VALUES (lower(p_email), coalesce(welcome, 0), now())
    RETURNING * INTO u;
  IF coalesce(welcome, 0) > 0 THEN
    INSERT INTO credit_ledger (user_id, delta, reason, balance_after)
      VALUES (u.id, welcome, 'welcome', u.credit_balance);
  END IF;
  RETURN u;
END $$ LANGUAGE plpgsql;

-- Débit de crédits : verrouille la ligne, refuse si solde insuffisant.
-- Retourne le nouveau solde, ou NULL si refusé.
CREATE FUNCTION spend_credits(p_user uuid, p_amount integer, p_reason text, p_repair uuid)
RETURNS integer AS $$
DECLARE
  bal integer;
BEGIN
  IF p_amount <= 0 THEN
    SELECT credit_balance INTO bal FROM users WHERE id = p_user;
    RETURN bal;
  END IF;
  SELECT credit_balance INTO bal FROM users WHERE id = p_user AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR bal < p_amount THEN
    RETURN NULL;
  END IF;
  UPDATE users SET credit_balance = bal - p_amount WHERE id = p_user;
  INSERT INTO credit_ledger (user_id, delta, reason, repair_id, balance_after)
    VALUES (p_user, -p_amount, p_reason, p_repair, bal - p_amount);
  RETURN bal - p_amount;
END $$ LANGUAGE plpgsql;

-- Ajout de crédits (pack acheté, geste commercial, remboursement).
CREATE FUNCTION grant_credits(p_user uuid, p_amount integer, p_reason text)
RETURNS integer AS $$
DECLARE
  bal integer;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  UPDATE users SET credit_balance = credit_balance + p_amount
    WHERE id = p_user AND deleted_at IS NULL
    RETURNING credit_balance INTO bal;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO credit_ledger (user_id, delta, reason, balance_after)
    VALUES (p_user, p_amount, p_reason, bal);
  RETURN bal;
END $$ LANGUAGE plpgsql;

-- Abonné Premium actif ?
CREATE FUNCTION is_premium(p_user uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$ LANGUAGE sql STABLE;

-- Consommation du mois civil en cours, par type (pour l'usage raisonnable).
CREATE FUNCTION month_usage(p_user uuid, p_kind usage_kind) RETURNS numeric AS $$
  SELECT coalesce(sum(quantity), 0) FROM usage_events
  WHERE user_id = p_user AND kind = p_kind
    AND created_at >= date_trunc('month', now());
$$ LANGUAGE sql STABLE;

-- Nombre de dépannages ouverts ce mois-ci.
CREATE FUNCTION month_repairs(p_user uuid) RETURNS integer AS $$
  SELECT count(*)::integer FROM repairs
  WHERE user_id = p_user AND created_at >= date_trunc('month', now());
$$ LANGUAGE sql STABLE;

-- Recherche d'artisans par code postal (code exact, sinon département).
CREATE FUNCTION find_pros(p_postal text, p_category text)
RETURNS SETOF pros AS $$
  SELECT p.* FROM pros p
  WHERE p.status = 'verified'
    AND (p_category IS NULL OR EXISTS (
          SELECT 1 FROM pro_category_links l WHERE l.pro_id = p.id AND l.category_slug = p_category))
    AND (p_postal = ANY (p.service_postal_codes)
         OR p.postal_code = p_postal
         OR left(p_postal, 2) = ANY (p.service_departments))
  ORDER BY (p_postal = ANY (p.service_postal_codes) OR p.postal_code = p_postal) DESC,
           p.company_name;
$$ LANGUAGE sql STABLE;

-- Suppression RGPD : efface les contenus, anonymise le compte.
CREATE FUNCTION delete_user_data(p_user uuid) RETURNS void AS $$
BEGIN
  DELETE FROM repairs WHERE user_id = p_user;          -- messages, photos, sources en cascade
  DELETE FROM equipment WHERE user_id = p_user;
  DELETE FROM sessions WHERE user_id = p_user;
  UPDATE service_requests
     SET contact_name = 'supprimé', contact_phone = NULL, contact_email = 'supprime@invalid',
         shared_summary = NULL, consent_share = false, user_id = NULL
   WHERE user_id = p_user;
  UPDATE users
     SET email = 'deleted+' || id || '@invalid', display_name = NULL, postal_code = NULL,
         consent_marketing = false, deleted_at = now()
   WHERE id = p_user;
  INSERT INTO audit_logs (actor_id, action, target) VALUES (p_user, 'gdpr_delete', p_user::text);
END $$ LANGUAGE plpgsql;

-- Purge des photos expirées (tâche quotidienne).
CREATE FUNCTION purge_expired_attachments() RETURNS integer AS $$
DECLARE n integer;
BEGIN
  DELETE FROM attachments a
   USING repairs r
   WHERE a.repair_id = r.id AND NOT r.keep AND a.expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$ LANGUAGE plpgsql;
