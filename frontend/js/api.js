// Camada de comunicação com o backend. Único arquivo que conhece a URL e usa fetch.
const api = (() => {
  // Quando aberto pelo próprio backend usa o mesmo endereço; no Live Server aponta para a porta 3000.
  const BASE = location.port === '3000' ? '/api/filmes' : 'http://localhost:3000/api/filmes';

  async function requisicao(caminho = '', opcoes = {}) {
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

  return {
    listar(filtros = {}) {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([chave, valor]) => {
        if (valor !== '' && valor !== undefined) params.append(chave, valor);
      });
      const query = params.toString();
      return requisicao(query ? `?${query}` : '');
    },
    buscar: (id) => requisicao(`/${id}`),
    criar: (dados) => requisicao('', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => requisicao(`/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => requisicao(`/${id}`, { method: 'DELETE' }),
    opcoes: () => requisicao('/opcoes'),
    estatisticas: () => requisicao('/estatisticas'),
  };
})();
