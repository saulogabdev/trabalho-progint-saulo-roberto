// Lógica de negócio: interpreta a requisição, chama o model e decide o status HTTP.
const Filme = require('../models/filmeModel');

// Converte o parâmetro :id; devolve null se não for um inteiro positivo.
function lerId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function listar(req, res) {
  const { busca, genero, assistido } = req.query;
  res.json(Filme.listar({ busca, genero, assistido }));
}

function opcoes(req, res) {
  res.json({ tipos: Filme.TIPOS, generos: Filme.GENEROS });
}

function estatisticas(req, res) {
  res.json(Filme.estatisticas());
}

function buscarPorId(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  const filme = Filme.buscarPorId(id);
  if (!filme) return res.status(404).json({ erro: 'Filme não encontrado' });

  res.json(filme);
}

function criar(req, res) {
  const dados = Filme.normalizar(req.body);
  const erros = Filme.validar(dados);
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  res.status(201).json(Filme.criar(dados));
}

function atualizar(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  const dados = Filme.normalizar(req.body);
  const erros = Filme.validar(dados);
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  const filme = Filme.atualizar(id, dados);
  if (!filme) return res.status(404).json({ erro: 'Filme não encontrado' });

  res.json(filme);
}

function excluir(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  if (!Filme.excluir(id)) return res.status(404).json({ erro: 'Filme não encontrado' });

  res.status(204).end();
}

module.exports = { listar, opcoes, estatisticas, buscarPorId, criar, atualizar, excluir };
