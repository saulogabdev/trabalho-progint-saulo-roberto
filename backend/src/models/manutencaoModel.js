// Representação, validação e consultas da entidade Manutenção.
const db = require('../config/database');

const TIPOS_SERVICO = [
  'Troca de óleo', 'Filtros', 'Pneus', 'Alinhamento e balanceamento', 'Freios',
  'Suspensão', 'Bateria', 'Sistema elétrico', 'Arrefecimento', 'Revisão geral',
  'Funilaria e pintura', 'Outro',
];
const TIPOS_VEICULO = ['carros', 'motos', 'caminhoes'];

// Placa Mercosul: 3 letras, 1 número, 1 letra, 2 números. Ex.: BRA2E19.
const REGEX_PLACA = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Campos do veículo FIPE: ou vêm todos preenchidos, ou nenhum.
const CAMPOS_FIPE = [
  'tipoVeiculo', 'marcaCodigo', 'marca', 'modeloCodigo', 'modelo',
  'anoCodigo', 'anoModelo', 'codigoFipe', 'valorFipe',
];

// Converte a linha do banco (snake_case) para o formato da API (camelCase).
function paraObjeto(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    placa: linha.placa,
    tipoServico: linha.tipo_servico,
    km: linha.km,
    data: linha.data,
    custo: linha.custo,
    oficina: linha.oficina,
    observacoes: linha.observacoes,
    tipoVeiculo: linha.tipo_veiculo,
    marcaCodigo: linha.marca_codigo,
    marca: linha.marca,
    modeloCodigo: linha.modelo_codigo,
    modelo: linha.modelo,
    anoCodigo: linha.ano_codigo,
    anoModelo: linha.ano_modelo,
    codigoFipe: linha.codigo_fipe,
    valorFipe: linha.valor_fipe,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

// Remove espaços e hífen e deixa em maiúsculas: "bra-2e19" -> "BRA2E19".
function normalizarPlaca(placa) {
  return typeof placa === 'string' ? placa.replace(/[\s-]/g, '').toUpperCase() : placa;
}

// Normaliza os dados recebidos (tira espaços, converte números, trata vazios como null).
function normalizar(dados = {}) {
  const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  const texto = (v) => (vazio(v) ? null : String(v).trim());
  const numero = (v) => (vazio(v) ? null : Number(v));

  return {
    placa: normalizarPlaca(dados.placa),
    tipoServico: texto(dados.tipoServico),
    km: numero(dados.km),
    data: texto(dados.data),
    custo: numero(dados.custo),
    oficina: texto(dados.oficina),
    observacoes: texto(dados.observacoes),
    tipoVeiculo: texto(dados.tipoVeiculo),
    marcaCodigo: texto(dados.marcaCodigo),
    marca: texto(dados.marca),
    modeloCodigo: texto(dados.modeloCodigo),
    modelo: texto(dados.modelo),
    anoCodigo: texto(dados.anoCodigo),
    anoModelo: texto(dados.anoModelo),
    codigoFipe: texto(dados.codigoFipe),
    valorFipe: numero(dados.valorFipe),
  };
}

// Data real no formato AAAA-MM-DD (rejeita 2025-02-30, por exemplo).
function dataValida(texto) {
  if (!REGEX_DATA.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(texto);
}

function hojeLocal() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 10);
}

// Devolve uma lista de mensagens de erro (vazia quando os dados são válidos).
function validar(dados) {
  const erros = [];

  if (typeof dados.placa !== 'string' || !REGEX_PLACA.test(dados.placa)) {
    erros.push('Placa inválida: use o padrão Mercosul (ex.: BRA2E19)');
  }
  if (!TIPOS_SERVICO.includes(dados.tipoServico)) {
    erros.push(`Tipo de serviço deve ser um de: ${TIPOS_SERVICO.join(', ')}`);
  }
  if (!Number.isInteger(dados.km) || dados.km <= 0 || dados.km > 3000000) {
    erros.push('Km deve ser um número inteiro positivo');
  }
  if (!dados.data || !dataValida(dados.data)) {
    erros.push('Data inválida (use AAAA-MM-DD)');
  } else if (dados.data > hojeLocal()) {
    erros.push('Data não pode estar no futuro');
  }
  if (dados.custo === null || !Number.isFinite(dados.custo) || dados.custo < 0 || dados.custo > 10000000) {
    erros.push('Custo deve ser um número maior ou igual a zero');
  }
  if (!dados.oficina || dados.oficina.length < 2 || dados.oficina.length > 100) {
    erros.push('Oficina é obrigatória e deve ter de 2 a 100 caracteres');
  }
  if (dados.observacoes && dados.observacoes.length > 500) {
    erros.push('Observações devem ter até 500 caracteres');
  }

  const preenchidos = CAMPOS_FIPE.filter((campo) => dados[campo] !== null);
  if (preenchidos.length > 0 && preenchidos.length < CAMPOS_FIPE.length) {
    erros.push('Dados do veículo FIPE incompletos: selecione marca, modelo e ano');
  } else if (preenchidos.length === CAMPOS_FIPE.length) {
    if (!TIPOS_VEICULO.includes(dados.tipoVeiculo)) {
      erros.push(`Tipo de veículo deve ser um de: ${TIPOS_VEICULO.join(', ')}`);
    }
    if (!Number.isFinite(dados.valorFipe) || dados.valorFipe <= 0) {
      erros.push('Valor FIPE inválido');
    }
  }
  return erros;
}

// Arredonda o custo para centavos antes de gravar.
function paraBanco(dados) {
  return { ...dados, custo: Math.round(dados.custo * 100) / 100 };
}

// Lista com filtros opcionais por placa (parcial) e tipo de serviço.
function listar({ placa, tipoServico } = {}) {
  const condicoes = [];
  const params = {};

  if (placa) {
    condicoes.push('placa LIKE @placa');
    params.placa = `%${normalizarPlaca(placa)}%`;
  }
  if (tipoServico) {
    condicoes.push('tipo_servico = @tipoServico');
    params.tipoServico = tipoServico;
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM manutencoes ${where} ORDER BY data DESC, id DESC`)
    .all(params)
    .map(paraObjeto);
}

function buscarPorId(id) {
  return paraObjeto(db.prepare('SELECT * FROM manutencoes WHERE id = ?').get(id));
}

function criar(dados) {
  const resultado = db
    .prepare(`
      INSERT INTO manutencoes (
        placa, tipo_servico, km, data, custo, oficina, observacoes,
        tipo_veiculo, marca_codigo, marca, modelo_codigo, modelo,
        ano_codigo, ano_modelo, codigo_fipe, valor_fipe
      ) VALUES (
        @placa, @tipoServico, @km, @data, @custo, @oficina, @observacoes,
        @tipoVeiculo, @marcaCodigo, @marca, @modeloCodigo, @modelo,
        @anoCodigo, @anoModelo, @codigoFipe, @valorFipe
      )
    `)
    .run(paraBanco(dados));
  return buscarPorId(resultado.lastInsertRowid);
}

// Devolve a manutenção atualizada, ou null se o id não existir.
function atualizar(id, dados) {
  const resultado = db
    .prepare(`
      UPDATE manutencoes
         SET placa = @placa, tipo_servico = @tipoServico, km = @km, data = @data,
             custo = @custo, oficina = @oficina, observacoes = @observacoes,
             tipo_veiculo = @tipoVeiculo, marca_codigo = @marcaCodigo, marca = @marca,
             modelo_codigo = @modeloCodigo, modelo = @modelo, ano_codigo = @anoCodigo,
             ano_modelo = @anoModelo, codigo_fipe = @codigoFipe, valor_fipe = @valorFipe,
             atualizado_em = datetime('now', 'localtime')
       WHERE id = @id
    `)
    .run({ ...paraBanco(dados), id });
  return resultado.changes ? buscarPorId(id) : null;
}

// Devolve true se algum registro foi removido.
function excluir(id) {
  return db.prepare('DELETE FROM manutencoes WHERE id = ?').run(id).changes > 0;
}

// Resumo por placa: quantidade, km atual, total gasto e quanto isso representa do valor FIPE.
// O veículo considerado é o da manutenção mais recente da placa que tenha dados FIPE.
function resumoPorVeiculo() {
  const linhas = db
    .prepare(`
      SELECT m.placa,
             COUNT(*)               AS quantidade,
             MAX(m.km)              AS kmAtual,
             ROUND(SUM(m.custo), 2) AS totalGasto,
             MAX(m.data)            AS ultimaManutencao,
             v.tipo_veiculo, v.marca_codigo, v.marca, v.modelo_codigo, v.modelo,
             v.ano_codigo, v.ano_modelo, v.codigo_fipe, v.valor_fipe
        FROM manutencoes m
        LEFT JOIN manutencoes v ON v.id = (
             SELECT id FROM manutencoes
              WHERE placa = m.placa AND codigo_fipe IS NOT NULL
              ORDER BY data DESC, id DESC
              LIMIT 1)
       GROUP BY m.placa
       ORDER BY m.placa
    `)
    .all();

  return linhas.map((l) => ({
    placa: l.placa,
    quantidade: l.quantidade,
    kmAtual: l.kmAtual,
    totalGasto: l.totalGasto,
    ultimaManutencao: l.ultimaManutencao,
    veiculo: l.codigo_fipe
      ? {
          tipoVeiculo: l.tipo_veiculo,
          marcaCodigo: l.marca_codigo,
          marca: l.marca,
          modeloCodigo: l.modelo_codigo,
          modelo: l.modelo,
          anoCodigo: l.ano_codigo,
          anoModelo: l.ano_modelo,
          codigoFipe: l.codigo_fipe,
          valorFipe: l.valor_fipe,
        }
      : null,
    percentualFipe: l.valor_fipe ? Math.round((l.totalGasto / l.valor_fipe) * 1000) / 10 : null,
  }));
}

module.exports = {
  TIPOS_SERVICO,
  TIPOS_VEICULO,
  normalizar,
  validar,
  listar,
  buscarPorId,
  criar,
  atualizar,
  excluir,
  resumoPorVeiculo,
};
