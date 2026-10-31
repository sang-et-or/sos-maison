-- Espace artisan, administration et paiements Stripe.

-- Un compte ne gère qu'une fiche artisan.
CREATE UNIQUE INDEX pros_one_per_user ON pros (user_id) WHERE user_id IS NOT NULL;
ALTER TABLE pros ADD COLUMN reviewed_at timestamptz;
ALTER TABLE pros ADD COLUMN review_note text CHECK (review_note IS NULL OR length(review_note) <= 500);

-- Événements Stripe déjà traités (le webhook peut être rejoué : on ne crédite jamais deux fois).
CREATE TABLE stripe_events (
  id          text PRIMARY KEY,
  type        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enregistre l'état d'un abonnement reçu de Stripe (création ou mise à jour).
CREATE FUNCTION apply_subscription(
  p_user uuid, p_customer text, p_subscription text, p_plan sub_plan, p_status sub_status,
  p_start timestamptz, p_end timestamptz, p_cancel boolean
) RETURNS void AS $$
  INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status,
                             current_period_start, current_period_end, cancel_at_period_end)
  VALUES (p_user, p_customer, p_subscription, p_plan, p_status, p_start, p_end, p_cancel)
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    status = excluded.status,
    plan = excluded.plan,
    current_period_start = coalesce(excluded.current_period_start, subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
$$ LANGUAGE sql;

-- Indicateurs du tableau de bord (mois calendaire en cours).
CREATE FUNCTION admin_stats() RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'users',          (SELECT count(*) FROM users WHERE deleted_at IS NULL),
    'users_7d',       (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '7 days'),
    'active_30d',     (SELECT count(DISTINCT user_id) FROM repairs WHERE updated_at > now() - interval '30 days'),
    'premium',        (SELECT count(DISTINCT user_id) FROM subscriptions
                        WHERE status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now())),
    'premium_yearly', (SELECT count(DISTINCT user_id) FROM subscriptions
                        WHERE plan = 'yearly' AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now())),
    'repairs_month',  (SELECT count(*) FROM repairs WHERE created_at >= date_trunc('month', now())),
    'resolved_month', (SELECT count(*) FROM repairs WHERE created_at >= date_trunc('month', now()) AND status = 'resolved'),
    'emergencies_month', (SELECT count(*) FROM repairs WHERE created_at >= date_trunc('month', now()) AND risk_level = 4),
    'requests_month', (SELECT count(*) FROM service_requests WHERE created_at >= date_trunc('month', now())),
    'pros_verified',  (SELECT count(*) FROM pros WHERE status = 'verified'),
    'pros_pending',   (SELECT count(*) FROM pros WHERE status = 'pending'),
    'cost_usd_month', (SELECT coalesce(round(sum(cost_usd), 2), 0) FROM usage_events WHERE created_at >= date_trunc('month', now())),
    'credits_month',  (SELECT coalesce(sum(credits), 0) FROM usage_events WHERE created_at >= date_trunc('month', now())),
    'packs_month',    (SELECT count(*) FROM credit_ledger WHERE reason LIKE 'pack:%' AND created_at >= date_trunc('month', now())),
    'cost_by_kind',   (SELECT coalesce(jsonb_object_agg(kind, c), '{}') FROM (
                        SELECT kind::text, round(sum(cost_usd), 2) AS c FROM usage_events
                        WHERE created_at >= date_trunc('month', now()) GROUP BY kind) k)
  );
$$ LANGUAGE sql STABLE;

-- Suppression RGPD : la fiche artisan éventuelle est retirée de l'annuaire et anonymisée.
CREATE OR REPLACE FUNCTION delete_user_data(p_user uuid) RETURNS void AS $$
BEGIN
  DELETE FROM repairs WHERE user_id = p_user;          -- messages, photos, sources en cascade
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
  UPDATE users
     SET email = 'deleted+' || id || '@invalid', display_name = NULL, postal_code = NULL,
         consent_marketing = false, deleted_at = now()
   WHERE id = p_user;
  INSERT INTO audit_logs (actor_id, action, target) VALUES (p_user, 'gdpr_delete', p_user::text);
END $$ LANGUAGE plpgsql;
