// Repassa as consultas da Tabela FIPE para o service e trata os erros.
const fipe = require('../services/fipeService');

// Os parâmetros entram na URL da API externa, então só aceitamos formatos conhecidos.
function parametrosValidos({ tipo, marca, modelo, ano }) {
  if (!Object.hasOwn(fipe.TIPOS, tipo)) return false;
  if (marca !== undefined && !/^\d+$/.test(marca)) return false;
  if (modelo !== undefined && !/^\d+$/.test(modelo)) return false;
  if (ano !== undefined && !/^\d+-\d+$/.test(ano)) return false;
  return true;
}

// Cria um handler que valida os parâmetros, chama o service e responde.
function consulta(funcao) {
  return async (req, res) => {
    const { tipo, marca, modelo, ano } = req.params;
    if (!parametrosValidos(req.params)) {
      return res.status(400).json({ erro: 'Parâmetros de consulta FIPE inválidos' });
    }
    try {
      res.json(await funcao(tipo, marca, modelo, ano));
    } catch (erro) {
      if (erro instanceof fipe.FipeErro) return res.status(erro.status).json({ erro: erro.message });
      console.error(erro);
      res.status(500).json({ erro: 'Erro interno ao consultar a FIPE' });
    }
  };
}

module.exports = {
  marcas: consulta(fipe.marcas),
  modelos: consulta(fipe.modelos),
  anos: consulta(fipe.anos),
  valor: consulta(fipe.valor),
};
