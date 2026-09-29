BEGIN;
-- Match ECMAScript whitespace used by catalogKey; stored keys cover every writer.
CREATE FUNCTION crm_catalog_key(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT lower(btrim(regexp_replace(translate(value, chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279), repeat(' ', 24)), ' +', ' ', 'g')))
$$;
ALTER TABLE users ADD COLUMN display_name_override text;
ALTER TABLE universities ADD COLUMN normalized_name text GENERATED ALWAYS AS (crm_catalog_key(name)) STORED;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM universities GROUP BY normalized_name HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Normalization collisions in universities; resolve with an approved data migration before deploying';
 END IF;
 IF EXISTS (SELECT 1 FROM universities WHERE normalized_name = '') THEN RAISE EXCEPTION 'Empty normalized names in universities'; END IF;
END $$;
CREATE UNIQUE INDEX universities_normalized_name_key ON universities(normalized_name);
ALTER TABLE universities ADD CONSTRAINT universities_normalized_name_nonempty CHECK (normalized_name <> '');
ALTER TABLE directions ADD COLUMN normalized_name text GENERATED ALWAYS AS (crm_catalog_key(name)) STORED;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM directions GROUP BY normalized_name HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Normalization collisions in directions; resolve with an approved data migration before deploying';
 END IF;
 IF EXISTS (SELECT 1 FROM directions WHERE normalized_name = '') THEN RAISE EXCEPTION 'Empty normalized names in directions'; END IF;
END $$;
CREATE UNIQUE INDEX directions_normalized_name_key ON directions(normalized_name);
ALTER TABLE directions ADD CONSTRAINT directions_normalized_name_nonempty CHECK (normalized_name <> '');
ALTER TABLE programs ADD COLUMN normalized_name text GENERATED ALWAYS AS (crm_catalog_key(name)) STORED;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM programs GROUP BY normalized_name HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Normalization collisions in programs; resolve with an approved data migration before deploying';
 END IF;
 IF EXISTS (SELECT 1 FROM programs WHERE normalized_name = '') THEN RAISE EXCEPTION 'Empty normalized names in programs'; END IF;
END $$;
CREATE UNIQUE INDEX programs_normalized_name_key ON programs(normalized_name);
ALTER TABLE programs ADD CONSTRAINT programs_normalized_name_nonempty CHECK (normalized_name <> '');
ALTER TABLE products ADD COLUMN normalized_name text GENERATED ALWAYS AS (crm_catalog_key(name)) STORED;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM products GROUP BY normalized_name HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Normalization collisions in products; resolve with an approved data migration before deploying';
 END IF;
 IF EXISTS (SELECT 1 FROM products WHERE normalized_name = '') THEN RAISE EXCEPTION 'Empty normalized names in products'; END IF;
END $$;
CREATE UNIQUE INDEX products_normalized_name_key ON products(normalized_name);
ALTER TABLE products ADD CONSTRAINT products_normalized_name_nonempty CHECK (normalized_name <> '');
COMMIT;
