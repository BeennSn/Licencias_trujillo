// Efecto secundario: carga .env.local antes que cualquier otro módulo.
// Los `import` de un archivo se evalúan siempre antes que su propio código
// (incluso antes de statements escritos arriba de ellos), así que esto debe
// importarse como el PRIMER import del script (ver db/seed.ts) para que
// process.env ya tenga las variables cuando se importe lib/db/client.
import { config } from "dotenv";

config({ path: ".env.local" });
