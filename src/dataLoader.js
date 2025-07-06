import { loadDb } from "./config.js";

let connection = null;

export async function initializeDatabase() {
  try {
    const db = await loadDb();
    connection = await db.connect();

    const response = await fetch("../data/spotify.parquet");
    const buffer = await response.arrayBuffer();

    await db.registerFileBuffer("spotify.parquet", new Uint8Array(buffer));

    await connection.query(`
        CREATE TABLE IF NOT EXISTS spotify AS 
        SELECT * FROM read_parquet('spotify.parquet')
    `);

    console.log("Database initialized and spotify table created successfully");
    return connection;
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

export async function getConnection() {
  if (!connection) {
    return await initializeDatabase();
  }
  return connection;
}

// Função auxiliar para executar queries
export async function executeQuery(sql) {
  try {
    const conn = await getConnection();
    const result = await conn.query(sql);
    const data = result.toArray().map(row => ({ ...row }))
    return data
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}

// Função para obter informações sobre a tabela
export async function getTableInfo() {
  try {
    const conn = await getConnection();
    const result = await conn.query("DESCRIBE spotify");
    return result.toArray();
  } catch (error) {
    console.error("Error getting table info:", error);
    throw error;
  }
}

// Função para obter contagem total de registros
export async function getTotalRecords() {
  try {
    const conn = await getConnection();
    const result = await conn.query("SELECT COUNT(*) as total FROM spotify");
    return result.toArray()[0].total;
  } catch (error) {
    console.error("Error getting total records:", error);
    throw error;
  }
}
