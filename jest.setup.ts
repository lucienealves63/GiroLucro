import { TextDecoder, TextEncoder } from "node:util";

// `src/db/index.ts` exige DATABASE_URL no import (mesmo sem conectar).
// Os testes nunca abrem conexão real: cada suíte cria seu próprio banco em
// memória (ver `tests/helpers/pgmem.ts`).
process.env.DATABASE_URL ??=
  "postgresql://girolucro:girolucro@127.0.0.1:5432/girolucro_test";

// O driver `pg` usa TextEncoder/TextDecoder, que o jsdom não expõe.
const g = globalThis as unknown as {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
g.TextEncoder ??= TextEncoder;
g.TextDecoder ??= TextDecoder;
// avisa ao React que os testes usam act() (senão ele reclama de cada update)
g.IS_REACT_ACT_ENVIRONMENT = true;
