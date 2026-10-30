-- Tests de la migration 0002 (à lancer après schema_test.sql ou sur une base neuve).
\set ON_ERROR_STOP 1

DO $$
DECLARE
  u users; other users; r uuid; m bigint; done smallint[]; s record;
BEGIN
  u := upsert_user('fiche@example.fr');
  other := upsert_user('intrus@example.fr');
  INSERT INTO repairs (user_id, title) VALUES (u.id, 'Chasse d''eau') RETURNING id INTO r;
  INSERT INTO messages (repair_id, role, content, card)
    VALUES (r, 'assistant', 'Voici la fiche',
            '{"titre":"Régler le flotteur","etapes":["a","b","c","d"]}')
    RETURNING id INTO m;

  done := set_card_step(u.id, m, 1::smallint, true);
  ASSERT done = '{1}', 'étape 1 cochée';
  done := set_card_step(u.id, m, 3::smallint, true);
  done := set_card_step(u.id, m, 1::smallint, true);
  ASSERT done = '{1,3}', 'pas de doublon, ordre croissant';
  done := set_card_step(u.id, m, 1::smallint, false);
  ASSERT done = '{3}', 'étape décochée';
  ASSERT set_card_step(u.id, m, 4::smallint, true) IS NULL, 'étape hors fiche refusée';
  ASSERT set_card_step(other.id, m, 0::smallint, true) IS NULL, 'fiche d''un autre compte refusée';

  BEGIN
    INSERT INTO messages (repair_id, role, content, card) VALUES (r, 'assistant', 'x', '{"titre":"sans étapes"}');
    RAISE EXCEPTION 'aurait dû échouer';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE repairs SET status = 'resolved', estimated_saving_eur = 120 WHERE id = r;
  INSERT INTO repairs (user_id, title, status) VALUES (u.id, 'Autre', 'open');
  SELECT * INTO s FROM user_stats(u.id);
  ASSERT s.repairs = 2 AND s.resolved = 1 AND s.saved_eur = 120, 'statistiques personnelles';
  ASSERT requests_last_day(u.id) = 0, 'aucune demande';

  RAISE NOTICE 'Tests des fiches de réparation : OK';
END $$;
