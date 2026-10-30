-- Fiches de réparation interactives et suivi des demandes d'intervention.

-- Fiche structurée produite par l'assistant (titre, diagnostic, outils, étapes…).
ALTER TABLE messages ADD COLUMN card jsonb;
-- Index des étapes cochées par l'utilisateur.
ALTER TABLE messages ADD COLUMN card_done smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE messages ADD CONSTRAINT messages_card_shape CHECK (
  card IS NULL OR (jsonb_typeof(card) = 'object' AND coalesce(jsonb_typeof(card -> 'etapes'), '') = 'array')
);

-- Économie estimée quand un dépannage est résolu sans artisan (affichée dans « Mon espace »).
ALTER TABLE repairs ADD COLUMN estimated_saving_eur integer CHECK (estimated_saving_eur IS NULL OR estimated_saving_eur BETWEEN 0 AND 2000);

-- Coche ou décoche une étape ; retourne la liste à jour (ou NULL si la fiche n'appartient pas à l'utilisateur).
CREATE FUNCTION set_card_step(p_user uuid, p_message bigint, p_step smallint, p_done boolean)
RETURNS smallint[] AS $$
DECLARE
  steps integer;
  result smallint[];
BEGIN
  SELECT jsonb_array_length(m.card -> 'etapes') INTO steps
    FROM messages m JOIN repairs r ON r.id = m.repair_id
   WHERE m.id = p_message AND r.user_id = p_user AND m.card IS NOT NULL
   FOR UPDATE OF m;
  IF NOT FOUND OR p_step < 0 OR p_step >= steps THEN
    RETURN NULL;
  END IF;
  UPDATE messages SET card_done = (
      SELECT coalesce(array_agg(DISTINCT s ORDER BY s), '{}')
      FROM unnest(CASE WHEN p_done THEN card_done || p_step ELSE array_remove(card_done, p_step) END) AS s
    )
   WHERE id = p_message
   RETURNING card_done INTO result;
  RETURN result;
END $$ LANGUAGE plpgsql;

-- Tableau de bord personnel.
CREATE FUNCTION user_stats(p_user uuid)
RETURNS TABLE (repairs integer, resolved integer, saved_eur integer) AS $$
  SELECT count(*)::integer,
         count(*) FILTER (WHERE status = 'resolved')::integer,
         coalesce(sum(estimated_saving_eur) FILTER (WHERE status = 'resolved'), 0)::integer
  FROM repairs WHERE user_id = p_user;
$$ LANGUAGE sql STABLE;

-- Limite anti-abus : demandes d'intervention envoyées par un compte sur 24 h.
CREATE FUNCTION requests_last_day(p_user uuid) RETURNS integer AS $$
  SELECT count(*)::integer FROM service_requests
  WHERE user_id = p_user AND created_at > now() - interval '1 day';
$$ LANGUAGE sql STABLE;
