-- Índice para el "contiene" sin espacios de la búsqueda («los 40» → «LOS40»). Debe coincidir exactamente
-- con la expresión de src/catalog/search.ts: replace(lower(f_unaccent(name)), ' ', '').
CREATE INDEX IF NOT EXISTS stations_name_nospace_search_idx ON stations USING gin (replace(lower(f_unaccent(name)), ' ', '') gin_trgm_ops);
