// Conexão com o banco SQLite e criação da tabela na primeira execução.
const path = require('path');
const Database = require('better-sqlite3');

const caminho = process.env.DB_PATH || path.join(__dirname, '..', '..', 'database.sqlite');
const db = new Database(caminho);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS filmes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo      TEXT    NOT NULL,
    tipo        TEXT    NOT NULL DEFAULT 'Filme',
    genero      TEXT    NOT NULL,
    ano         INTEGER NOT NULL,
    nota        REAL,
    assistido   INTEGER NOT NULL DEFAULT 0,
    sinopse     TEXT,
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em TEXT  NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

module.exports = db;
