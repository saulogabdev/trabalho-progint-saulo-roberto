// Lógica de negócio: interpreta a requisição, chama o model e decide o status HTTP.
const Manutencao = require('../models/manutencaoModel');

// Converte o parâmetro :id; devolve null se não for um inteiro positivo.
function lerId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function listar(req, res) {
  const { placa, tipoServico } = req.query;
  res.json(Manutencao.listar({ placa, tipoServico }));
}

function opcoes(req, res) {
  res.json({ tiposServico: Manutencao.TIPOS_SERVICO, tiposVeiculo: Manutencao.TIPOS_VEICULO });
}

function veiculos(req, res) {
  res.json(Manutencao.resumoPorVeiculo());
}

function buscarPorId(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  const manutencao = Manutencao.buscarPorId(id);
  if (!manutencao) return res.status(404).json({ erro: 'Manutenção não encontrada' });

  res.json(manutencao);
}

function criar(req, res) {
  const dados = Manutencao.normalizar(req.body);
  const erros = Manutencao.validar(dados);
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  res.status(201).json(Manutencao.criar(dados));
}

function atualizar(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  const dados = Manutencao.normalizar(req.body);
  const erros = Manutencao.validar(dados);
  if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

  const manutencao = Manutencao.atualizar(id, dados);
  if (!manutencao) return res.status(404).json({ erro: 'Manutenção não encontrada' });

  res.json(manutencao);
}

function excluir(req, res) {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  if (!Manutencao.excluir(id)) return res.status(404).json({ erro: 'Manutenção não encontrada' });

  res.status(204).end();
}

module.exports = { listar, opcoes, veiculos, buscarPorId, criar, atualizar, excluir };
