// Camada de comunicação com o backend. Único arquivo que conhece a URL e usa fetch.
const api = (() => {
  // Quando aberto pelo próprio backend usa o mesmo endereço; no Live Server aponta para a porta 3000.
  const BASE = location.port === '3000' ? '/api' : 'http://localhost:3000/api';

  async function requisicao(caminho, opcoes = {}) {
    let resposta;
    try {
      resposta = await fetch(BASE + caminho, {
        headers: { 'Content-Type': 'application/json' },
        ...opcoes,
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Ele está rodando?');
    }

    if (resposta.status === 204) return null;

    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(corpo?.erro || `Erro ${resposta.status}`);
    }
    return corpo;
  }

  function comFiltros(caminho, filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor !== '' && valor !== undefined) params.append(chave, valor);
    });
    const query = params.toString();
    return query ? `${caminho}?${query}` : caminho;
  }

  return {
    manutencoes: {
      listar: (filtros) => requisicao(comFiltros('/manutencoes', filtros)),
      buscar: (id) => requisicao(`/manutencoes/${id}`),
      criar: (dados) => requisicao('/manutencoes', { method: 'POST', body: JSON.stringify(dados) }),
      atualizar: (id, dados) => requisicao(`/manutencoes/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
      excluir: (id) => requisicao(`/manutencoes/${id}`, { method: 'DELETE' }),
      opcoes: () => requisicao('/manutencoes/opcoes'),
      veiculos: () => requisicao('/manutencoes/veiculos'),
    },
    fipe: {
      marcas: (tipo) => requisicao(`/fipe/${tipo}/marcas`),
      modelos: (tipo, marca) => requisicao(`/fipe/${tipo}/marcas/${marca}/modelos`),
      anos: (tipo, marca, modelo) => requisicao(`/fipe/${tipo}/marcas/${marca}/modelos/${modelo}/anos`),
      valor: (tipo, marca, modelo, ano) =>
        requisicao(`/fipe/${tipo}/marcas/${marca}/modelos/${modelo}/anos/${ano}`),
    },
  };
})();
