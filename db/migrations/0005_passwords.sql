-- Connexion par mot de passe (l'e-mail ne sert plus qu'en cas d'oubli).
ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN password_set_at timestamptz;
ALTER TABLE users ADD COLUMN signup_ip text;
CREATE INDEX users_signup_ip ON users (signup_ip, created_at) WHERE signup_ip IS NOT NULL;

-- Tentatives de connexion (limite contre les essais de mots de passe en série).
CREATE TABLE login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  ip          text,
  ok          boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email ON login_attempts (email, created_at DESC);
CREATE INDEX login_attempts_ip ON login_attempts (ip, created_at DESC);

-- La suppression RGPD efface aussi le mot de passe.
CREATE OR REPLACE FUNCTION delete_user_data(p_user uuid) RETURNS void AS $$
BEGIN
  DELETE FROM repairs WHERE user_id = p_user;
  DELETE FROM equipment WHERE user_id = p_user;
  DELETE FROM sessions WHERE user_id = p_user;
  UPDATE service_requests
     SET contact_name = 'supprimé', contact_phone = NULL, contact_email = 'supprime@invalid',
         shared_summary = NULL, consent_share = false, user_id = NULL
   WHERE user_id = p_user;
  UPDATE pros
     SET status = 'suspended', user_id = NULL, phone = NULL, email = NULL, website = NULL,
         description = NULL, siret = NULL, company_name = 'Artisan supprimé', updated_at = now()
   WHERE user_id = p_user;
  DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = p_user);
  UPDATE users
     SET email = 'deleted+' || id || '@invalid', display_name = NULL, postal_code = NULL,
         consent_marketing = false, password_hash = NULL, signup_ip = NULL, deleted_at = now()
   WHERE id = p_user;
  INSERT INTO audit_logs (actor_id, action, target) VALUES (p_user, 'gdpr_delete', p_user::text);
END $$ LANGUAGE plpgsql;
