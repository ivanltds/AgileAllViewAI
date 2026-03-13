/**
 * scripts/initDb.ts
 * Run once to create the SQLite database and schema.
 * Called automatically via postCreateCommand in devcontainer.
 *
 * Usage: npx ts-node scripts/initDb.ts
 */

// Altere de:
import { getDb } from "../lib/storage/db";

async function init() {
  // 1. Primeiro, inicializamos a conexão com o banco
  const db = getDb();
  
  console.log(`✓ Database ready at: ${process.env.DATABASE_PATH ?? "./database/agileallview.db"}`);

  // 2. Aqui você pode adicionar as queries de criação de tabela se necessário
  // Exemplo: db.exec("CREATE TABLE IF NOT EXISTS users (...)");

  // 3. Listamos as tabelas existentes para confirmar o sucesso
  // Usamos 'as any[]' para evitar o erro de tipagem do TypeScript
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const tableNames = tables.map(r => r.name).join(", ");

  console.log(`✓ Tables found: ${tableNames || "None yet"}`);
}

init().catch((err) => {
  console.error("✗ Error initializing database:", err);
  process.exit(1);
});