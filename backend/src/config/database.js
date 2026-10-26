// Conexão com o banco SQLite e criação da tabela na primeira execução.
const path = require('path');
const Database = require('better-sqlite3');

const caminho = process.env.DB_PATH || path.join(__dirname, '..', '..', 'database.sqlite');
const db = new Database(caminho);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS manutencoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    placa          TEXT    NOT NULL,
    tipo_servico   TEXT    NOT NULL,
    km             INTEGER NOT NULL,
    data           TEXT    NOT NULL,
    custo          REAL    NOT NULL,
    oficina        TEXT    NOT NULL,
    observacoes    TEXT,

    -- Dados do veículo vindos da Tabela FIPE (opcionais)
    tipo_veiculo   TEXT,
    marca_codigo   TEXT,
    marca          TEXT,
    modelo_codigo  TEXT,
    modelo         TEXT,
    ano_codigo     TEXT,
    ano_modelo     TEXT,
    codigo_fipe    TEXT,
    valor_fipe     REAL,

    criado_em      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_manutencoes_placa ON manutencoes (placa);
`);

module.exports = db;
