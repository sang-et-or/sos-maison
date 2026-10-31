-- Recherche d'artisans via Google : suivi des coûts et limite par compte.
ALTER TYPE usage_kind ADD VALUE IF NOT EXISTS 'places';

INSERT INTO settings (key, value, description) VALUES
  ('google_search_daily_limit', '10', 'Recherches Google d''artisans par compte et par jour')
ON CONFLICT (key) DO NOTHING;
