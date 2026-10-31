-- Abonnements, fiches artisan et indicateurs d'administration.
\set ON_ERROR_STOP 1

DO $$
DECLARE
  u users; p uuid; n integer; s jsonb; ok boolean;
BEGIN
  u := upsert_user('abonne@example.fr');

  -- 1. Abonnement reçu de Stripe, puis mis à jour (même identifiant) : une seule ligne.
  PERFORM apply_subscription(u.id, 'cus_1', 'sub_1', 'monthly', 'active', now(), now() + interval '1 month', false);
  ASSERT is_premium(u.id), 'premium après abonnement';
  PERFORM apply_subscription(u.id, 'cus_1', 'sub_1', 'monthly', 'active', NULL, NULL, true);
  SELECT count(*) INTO n FROM subscriptions WHERE user_id = u.id;
  ASSERT n = 1, 'mise à jour sans doublon';
  SELECT cancel_at_period_end INTO ok FROM subscriptions WHERE stripe_subscription_id = 'sub_1';
  ASSERT ok, 'résiliation programmée enregistrée';
  ASSERT is_premium(u.id), 'dates conservées si absentes de la mise à jour';
  PERFORM apply_subscription(u.id, 'cus_1', 'sub_1', 'monthly', 'canceled', NULL, NULL, false);
  ASSERT NOT is_premium(u.id), 'plus premium après résiliation';

  -- 2. Événements Stripe : un seul traitement par identifiant.
  INSERT INTO stripe_events (id, type) VALUES ('evt_1', 'checkout.session.completed');
  INSERT INTO stripe_events (id, type) VALUES ('evt_1', 'checkout.session.completed') ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM stripe_events;
  ASSERT n = 1, 'événement unique';

  -- 3. Une fiche artisan par compte.
  INSERT INTO pros (user_id, company_name, city, postal_code, siret, phone, email)
    VALUES (u.id, 'Plomberie Test', 'Lyon', '69003', '73282932000074', '0472000000', 'pro@example.fr') RETURNING id INTO p;
  BEGIN
    INSERT INTO pros (user_id, company_name, city, postal_code) VALUES (u.id, 'Doublon', 'Lyon', '69003');
    ASSERT false, 'deuxième fiche refusée';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM find_pros('69003', NULL) WHERE id = p;
  ASSERT n = 0, 'fiche en attente invisible dans l''annuaire';

  -- 4. Indicateurs.
  s := admin_stats();
  ASSERT (s->>'pros_pending')::int >= 1, 'artisans en attente comptés';
  ASSERT s ? 'cost_usd_month' AND s ? 'premium_yearly', 'indicateurs présents';

  -- 5. Suppression RGPD : fiche retirée et anonymisée.
  PERFORM delete_user_data(u.id);
  SELECT count(*) INTO n FROM pros WHERE id = p AND status = 'suspended' AND user_id IS NULL AND siret IS NULL AND email IS NULL;
  ASSERT n = 1, 'fiche artisan anonymisée';

  RAISE NOTICE 'Tests abonnements, artisans et administration : OK';
END $$;
