-- Tests du schéma : exécuter sur une base vide après la migration.
-- psql -v ON_ERROR_STOP=1 -f db/tests/schema_test.sql
\set ON_ERROR_STOP 1

DO $$
DECLARE
  u users; u2 users; bal integer; n integer; r uuid; p uuid;
BEGIN
  -- 1. Création de compte : 100 crédits offerts, une seule fois.
  u := upsert_user('Marie@Example.fr');
  ASSERT u.email = 'marie@example.fr', 'e-mail normalisé';
  ASSERT u.credit_balance = 100, 'crédits de bienvenue';
  u2 := upsert_user('marie@example.fr');
  ASSERT u2.id = u.id AND u2.credit_balance = 100, 'pas de second bonus';
  SELECT count(*) INTO n FROM credit_ledger WHERE user_id = u.id;
  ASSERT n = 1, 'une seule ligne de bienvenue';

  -- 2. Débit de crédits.
  bal := spend_credits(u.id, 30, 'usage:message', NULL);
  ASSERT bal = 70, 'débit de 30';
  bal := spend_credits(u.id, 71, 'usage:video_minute', NULL);
  ASSERT bal IS NULL, 'refus si solde insuffisant';
  SELECT credit_balance INTO bal FROM users WHERE id = u.id;
  ASSERT bal = 70, 'solde inchangé après refus';
  bal := grant_credits(u.id, 100, 'pack');
  ASSERT bal = 170, 'ajout pack';
  SELECT sum(delta) INTO bal FROM credit_ledger WHERE user_id = u.id;
  ASSERT bal = 170, 'registre cohérent avec le solde';

  -- 3. Niveau de risque monotone.
  INSERT INTO repairs (user_id, title) VALUES (u.id, 'Odeur bizarre') RETURNING id INTO r;
  UPDATE repairs SET risk_level = 4 WHERE id = r;
  UPDATE repairs SET risk_level = 1 WHERE id = r;
  SELECT risk_level INTO n FROM repairs WHERE id = r;
  ASSERT n = 4, 'le risque ne redescend jamais';

  -- 4. Premium et usage mensuel.
  ASSERT NOT is_premium(u.id), 'pas premium par défaut';
  INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status, current_period_end)
    VALUES (u.id, 'cus_test', 'monthly', 'active', now() + interval '20 days');
  ASSERT is_premium(u.id), 'premium actif';
  INSERT INTO usage_events (user_id, kind, provider, quantity) VALUES
    (u.id, 'video_minute', 'google', 3.5), (u.id, 'video_minute', 'google', 2);
  ASSERT month_usage(u.id, 'video_minute') = 5.5, 'cumul minutes vidéo';
  ASSERT month_repairs(u.id) = 1, 'dépannages du mois';

  -- 5. Annuaire : code postal exact puis département.
  INSERT INTO pros (company_name, city, postal_code, service_postal_codes, service_departments, status)
    VALUES ('Plomberie Durand', 'Lyon', '69003', '{69003,69006}', '{}', 'verified') RETURNING id INTO p;
  INSERT INTO pro_category_links VALUES (p, 'plombier');
  INSERT INTO pros (company_name, city, postal_code, service_departments, status)
    VALUES ('Dépann 69', 'Villeurbanne', '69100', '{69}', 'verified') RETURNING id INTO p;
  INSERT INTO pro_category_links VALUES (p, 'plombier');
  INSERT INTO pros (company_name, city, postal_code, service_departments, status)
    VALUES ('Non vérifié', 'Lyon', '69003', '{69}', 'pending');
  SELECT count(*) INTO n FROM find_pros('69006', 'plombier');
  ASSERT n = 2, 'deux plombiers vérifiés pour 69006';
  ASSERT (SELECT company_name FROM find_pros('69006', 'plombier') LIMIT 1) = 'Plomberie Durand',
    'le code postal exact passe en premier';
  SELECT count(*) INTO n FROM find_pros('75011', 'plombier');
  ASSERT n = 0, 'aucun artisan hors zone';

  -- 6. Consentement obligatoire pour partager le résumé.
  BEGIN
    INSERT INTO service_requests (pro_id, contact_name, contact_email, postal_code, message, shared_summary, consent_share)
      VALUES (p, 'Marie', 'marie@example.fr', '69006', 'Fuite', 'résumé', false);
    RAISE EXCEPTION 'aurait dû échouer';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO service_requests (user_id, pro_id, repair_id, contact_name, contact_email, postal_code, message, shared_summary, consent_share)
    VALUES (u.id, p, r, 'Marie', 'marie@example.fr', '69006', 'Fuite', 'résumé', true);

  -- 7. Photos : expiration sauf dépannage conservé.
  INSERT INTO attachments (repair_id, kind, mime_type, bytes, expires_at)
    VALUES (r, 'photo', 'image/jpeg', '\xffd8'::bytea, now() - interval '1 day');
  n := purge_expired_attachments();
  ASSERT n = 1, 'photo expirée purgée';

  -- 8. Suppression RGPD.
  PERFORM delete_user_data(u.id);
  SELECT count(*) INTO n FROM repairs WHERE user_id = u.id;
  ASSERT n = 0, 'dépannages supprimés';
  ASSERT (SELECT deleted_at IS NOT NULL AND email LIKE 'deleted+%' FROM users WHERE id = u.id), 'compte anonymisé';
  ASSERT (SELECT shared_summary IS NULL AND user_id IS NULL FROM service_requests WHERE contact_name = 'supprimé'),
    'demande d''intervention anonymisée';
  u2 := upsert_user('marie@example.fr');
  ASSERT u2.id <> u.id AND u2.credit_balance = 0, 'réinscription possible, sans nouveaux crédits offerts';

  RAISE NOTICE 'Tous les tests du schéma passent';
END $$;
