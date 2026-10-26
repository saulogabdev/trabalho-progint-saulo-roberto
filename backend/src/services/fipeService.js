// Integração com a API externa da Tabela FIPE (Parallelum, v2).
// Única parte do sistema que conhece a URL da FIPE. Guarda as respostas em cache
// para economizar o limite diário (500 requisições/dia sem token, 1000 com token).
const BASE_URL = process.env.FIPE_URL || 'https://fipe.parallelum.com.br/api/v2';
const TOKEN = process.env.FIPE_TOKEN; // opcional: token gratuito em https://fipe.api.br
const CACHE_HORAS = 24; // a tabela FIPE só muda uma vez por mês
const TIMEOUT_MS = 10000;

// Nossos nomes em português -> nomes usados pela API.
const TIPOS = { carros: 'cars', motos: 'motorcycles', caminhoes: 'trucks' };

const cache = new Map();

class FipeErro extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

async function buscar(caminho) {
  const salvo = cache.get(caminho);
  if (salvo && salvo.expiraEm > Date.now()) return salvo.dados;

  let resposta;
  try {
    resposta = await fetch(BASE_URL + caminho, {
      headers: TOKEN ? { 'X-Subscription-Token': TOKEN } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new FipeErro('Não foi possível consultar a Tabela FIPE agora. Tente novamente mais tarde.', 502);
  }

  if (resposta.status === 404) throw new FipeErro('Veículo não encontrado na Tabela FIPE', 404);
  if (resposta.status === 429) throw new FipeErro('Limite diário de consultas à FIPE atingido', 503);
  if (!resposta.ok) throw new FipeErro(`A Tabela FIPE respondeu com erro ${resposta.status}`, 502);

  const dados = await resposta.json();
  cache.set(caminho, { dados, expiraEm: Date.now() + CACHE_HORAS * 60 * 60 * 1000 });
  return dados;
}

// A API devolve { code, name }; o sistema usa { codigo, nome }.
const paraOpcoes = (lista) => lista.map((item) => ({ codigo: String(item.code), nome: item.name }));

// "R$ 106.138,00" -> 106138
function precoParaNumero(preco) {
  return Number(String(preco).replace(/[^\d,]/g, '').replace(',', '.'));
}

async function marcas(tipo) {
  return paraOpcoes(await buscar(`/${TIPOS[tipo]}/brands`));
}

async function modelos(tipo, marca) {
  return paraOpcoes(await buscar(`/${TIPOS[tipo]}/brands/${marca}/models`));
}

// A FIPE usa o ano 32000 para veículos zero km.
async function anos(tipo, marca, modelo) {
  const lista = paraOpcoes(await buscar(`/${TIPOS[tipo]}/brands/${marca}/models/${modelo}/years`));
  return lista.map((ano) => ({ ...ano, nome: ano.nome.replace(/^32000\b/, 'Zero km') }));
}

async function valor(tipo, marca, modelo, ano) {
  const v = await buscar(`/${TIPOS[tipo]}/brands/${marca}/models/${modelo}/years/${ano}`);
  return {
    marca: v.brand,
    modelo: v.model,
    anoModelo: v.modelYear,
    combustivel: v.fuel,
    codigoFipe: String(v.codeFipe).trim(),
    preco: v.price,
    valor: precoParaNumero(v.price),
    mesReferencia: v.referenceMonth,
  };
}

module.exports = { TIPOS, FipeErro, marcas, modelos, anos, valor };
