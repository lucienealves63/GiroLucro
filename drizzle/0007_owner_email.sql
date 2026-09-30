-- Corrige o e-mail administrativo sem alterar contas de teste já configuradas.
UPDATE "users"
SET "is_test" = true
WHERE lower("email") = 'lucieealves63@gmail.com'
  AND "is_test" = false;
