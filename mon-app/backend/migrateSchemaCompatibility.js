import { createDbPool } from "./config/db.js";

const db = createDbPool();

async function columnExists(table, column) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(row.count) > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) return;
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`Colonne ajoutee : ${table}.${column}`);
}

try {
  await addColumn("etudiants", "province", "VARCHAR(120) NULL AFTER `ville`");
  await addColumn("notifications", "demande_stage_id", "BIGINT UNSIGNED NULL AFTER `type_notification`");
  await addColumn("notifications", "contrat_id", "BIGINT UNSIGNED NULL AFTER `demande_stage_id`");
  await addColumn("notifications", "lien_action", "VARCHAR(255) NULL AFTER `contrat_id`");

  if (await columnExists("messages", "conversation_id")) {
    const [[column]] = await db.query(
      `SELECT IS_NULLABLE AS nullable
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'messages'
          AND COLUMN_NAME = 'conversation_id'`
    );
    if (column.nullable === "NO") {
      await db.query(
        "ALTER TABLE messages MODIFY COLUMN conversation_id BIGINT UNSIGNED NULL"
      );
      console.log("Colonne ajustee : messages.conversation_id accepte NULL");
    }
  }

  console.log("Schema de base de donnees compatible.");
} finally {
  await db.end();
}
