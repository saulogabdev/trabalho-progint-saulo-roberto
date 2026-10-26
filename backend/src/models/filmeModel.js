// Representação, validação e consultas da entidade Filme.
const db = require('../config/database');

const TIPOS = ['Filme', 'Série'];
const GENEROS = [
  'Ação', 'Animação', 'Aventura', 'Comédia', 'Documentário', 'Drama',
  'Fantasia', 'Ficção científica', 'Romance', 'Suspense', 'Terror', 'Outro',
];
const ANO_MINIMO = 1888; // primeiro filme da história (Roundhay Garden Scene)

// Converte a linha do banco para o formato devolvido pela API.
function paraObjeto(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    titulo: linha.titulo,
    tipo: linha.tipo,
    genero: linha.genero,
    ano: linha.ano,
    nota: linha.nota,
    assistido: linha.assistido === 1,
    sinopse: linha.sinopse,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

// Normaliza os dados recebidos (tira espaços, aplica valores padrão).
function normalizar(dados = {}) {
  const texto = (v) => (typeof v === 'string' ? v.trim() : v);
  const vazio = (v) => v === undefined || v === null || v === '';
  return {
    titulo: texto(dados.titulo),
    tipo: vazio(dados.tipo) ? 'Filme' : texto(dados.tipo),
    genero: texto(dados.genero),
    ano: vazio(dados.ano) ? dados.ano : Number(dados.ano),
    nota: vazio(dados.nota) ? null : Number(dados.nota),
    assistido: dados.assistido === true || dados.assistido === 'true',
    sinopse: vazio(texto(dados.sinopse)) ? null : texto(dados.sinopse),
  };
}

// Devolve uma lista de mensagens de erro (vazia quando os dados são válidos).
function validar(dados) {
  const erros = [];
  const anoMaximo = new Date().getFullYear() + 5;

  if (typeof dados.titulo !== 'string' || dados.titulo.length < 1 || dados.titulo.length > 150) {
    erros.push('Título é obrigatório e deve ter até 150 caracteres');
  }
  if (!TIPOS.includes(dados.tipo)) {
    erros.push(`Tipo deve ser um de: ${TIPOS.join(', ')}`);
  }
  if (!GENEROS.includes(dados.genero)) {
    erros.push(`Gênero deve ser um de: ${GENEROS.join(', ')}`);
  }
  if (!Number.isInteger(dados.ano) || dados.ano < ANO_MINIMO || dados.ano > anoMaximo) {
    erros.push(`Ano deve ser um número inteiro entre ${ANO_MINIMO} e ${anoMaximo}`);
  }
  if (dados.nota !== null) {
    if (Number.isNaN(dados.nota) || dados.nota < 0 || dados.nota > 10) {
      erros.push('Nota deve ser um número entre 0 e 10');
    } else if (!dados.assistido) {
      erros.push('Só é possível dar nota a um título já assistido');
    }
  }
  if (dados.sinopse !== null && (typeof dados.sinopse !== 'string' || dados.sinopse.length > 1000)) {
    erros.push('Sinopse deve ter até 1000 caracteres');
  }
  return erros;
}

// Lista com filtros opcionais: busca no título, gênero e situação.
function listar({ busca, genero, assistido } = {}) {
  const condicoes = [];
  const params = {};

  if (busca) {
    condicoes.push('titulo LIKE @busca');
    params.busca = `%${busca}%`;
  }
  if (genero) {
    condicoes.push('genero = @genero');
    params.genero = genero;
  }
  if (assistido === 'true' || assistido === 'false') {
    condicoes.push('assistido = @assistido');
    params.assistido = assistido === 'true' ? 1 : 0;
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM filmes ${where} ORDER BY titulo COLLATE NOCASE`)
    .all(params)
    .map(paraObjeto);
}

function buscarPorId(id) {
  return paraObjeto(db.prepare('SELECT * FROM filmes WHERE id = ?').get(id));
}

function criar(dados) {
  const resultado = db
    .prepare(`
      INSERT INTO filmes (titulo, tipo, genero, ano, nota, assistido, sinopse)
      VALUES (@titulo, @tipo, @genero, @ano, @nota, @assistido, @sinopse)
    `)
    .run({ ...dados, assistido: dados.assistido ? 1 : 0 });
  return buscarPorId(resultado.lastInsertRowid);
}

// Devolve o filme atualizado, ou null se o id não existir.
function atualizar(id, dados) {
  const resultado = db
    .prepare(`
      UPDATE filmes
         SET titulo = @titulo, tipo = @tipo, genero = @genero, ano = @ano,
             nota = @nota, assistido = @assistido, sinopse = @sinopse,
             atualizado_em = datetime('now', 'localtime')
       WHERE id = @id
    `)
    .run({ ...dados, assistido: dados.assistido ? 1 : 0, id });
  return resultado.changes ? buscarPorId(id) : null;
}

// Devolve true se algum registro foi removido.
function excluir(id) {
  return db.prepare('DELETE FROM filmes WHERE id = ?').run(id).changes > 0;
}

// Números para o painel de resumo da tela.
function estatisticas() {
  return db
    .prepare(`
      SELECT COUNT(*)                                  AS total,
             COALESCE(SUM(assistido), 0)               AS assistidos,
             COUNT(*) - COALESCE(SUM(assistido), 0)    AS paraAssistir,
             ROUND(AVG(nota), 1)                       AS notaMedia
        FROM filmes
    `)
    .get();
}

module.exports = {
  TIPOS,
  GENEROS,
  normalizar,
  validar,
  listar,
  buscarPorId,
  criar,
  atualizar,
  excluir,
  estatisticas,
};
