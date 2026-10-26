// Manipulação do DOM e eventos da tela. Não conhece URLs: tudo passa pelo api.js.
const $ = (id) => document.getElementById(id);

const form = $('form-filme');
const campos = {
  id: $('id'),
  titulo: $('titulo'),
  tipo: $('tipo'),
  genero: $('genero'),
  ano: $('ano'),
  assistido: $('assistido'),
  nota: $('nota'),
  sinopse: $('sinopse'),
};
const filtros = {
  busca: $('filtro-busca'),
  genero: $('filtro-genero'),
  assistido: $('filtro-assistido'),
};

let temporizadorMensagem;
let temporizadorBusca;

function mostrarMensagem(texto, tipo = 'sucesso') {
  const caixa = $('mensagem');
  caixa.textContent = texto;
  caixa.className = `mensagem ${tipo}`;
  clearTimeout(temporizadorMensagem);
  temporizadorMensagem = setTimeout(() => {
    caixa.textContent = '';
    caixa.className = 'mensagem';
  }, 5000);
}

function preencherSelect(select, valores) {
  valores.forEach((valor) => select.add(new Option(valor, valor)));
}

function atualizarCampoNota() {
  campos.nota.disabled = !campos.assistido.checked;
  if (!campos.assistido.checked) campos.nota.value = '';
}

function lerFormulario() {
  return {
    titulo: campos.titulo.value,
    tipo: campos.tipo.value,
    genero: campos.genero.value,
    ano: campos.ano.value,
    assistido: campos.assistido.checked,
    nota: campos.nota.value,
    sinopse: campos.sinopse.value,
  };
}

function limparFormulario() {
  form.reset();
  campos.id.value = '';
  atualizarCampoNota();
  $('titulo-form').textContent = 'Cadastrar título';
  $('btn-salvar').textContent = 'Cadastrar título';
  $('btn-cancelar').hidden = true;
}

function iniciarEdicao(filme) {
  campos.id.value = filme.id;
  campos.titulo.value = filme.titulo;
  campos.tipo.value = filme.tipo;
  campos.genero.value = filme.genero;
  campos.ano.value = filme.ano;
  campos.assistido.checked = filme.assistido;
  atualizarCampoNota();
  campos.nota.value = filme.nota ?? '';
  campos.sinopse.value = filme.sinopse ?? '';

  $('titulo-form').textContent = `Editando: ${filme.titulo}`;
  $('btn-salvar').textContent = 'Salvar alterações';
  $('btn-cancelar').hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
  campos.titulo.focus();
}

function criarBotao(texto, rotulo, classe, aoClicar) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.textContent = texto;
  botao.className = `btn ${classe}`;
  botao.setAttribute('aria-label', rotulo);
  botao.addEventListener('click', aoClicar);
  return botao;
}

function desenharTabela(filmes) {
  const corpo = $('tabela-corpo');
  corpo.innerHTML = '';
  $('vazio').hidden = filmes.length > 0;

  filmes.forEach((filme) => {
    const linha = corpo.insertRow();

    const celulaTitulo = linha.insertCell();
    const nome = document.createElement('strong');
    nome.textContent = filme.titulo; // textContent evita injeção de HTML
    celulaTitulo.appendChild(nome);
    if (filme.sinopse) {
      const sinopse = document.createElement('small');
      sinopse.className = 'sinopse';
      sinopse.textContent = filme.sinopse;
      celulaTitulo.appendChild(sinopse);
    }

    linha.insertCell().textContent = filme.tipo;
    linha.insertCell().textContent = filme.genero;
    linha.insertCell().textContent = filme.ano;

    const etiqueta = document.createElement('span');
    etiqueta.className = `etiqueta ${filme.assistido ? 'ok' : 'pendente'}`;
    etiqueta.textContent = filme.assistido ? 'Assistido' : 'Para assistir';
    linha.insertCell().appendChild(etiqueta);

    linha.insertCell().textContent = filme.nota !== null ? `⭐ ${filme.nota}` : '—';

    const acoes = linha.insertCell();
    acoes.className = 'celula-acoes';
    acoes.append(
      criarBotao('Editar', `Editar ${filme.titulo}`, 'btn-secundario', () => iniciarEdicao(filme)),
      criarBotao('Excluir', `Excluir ${filme.titulo}`, 'btn-perigo', () => excluirFilme(filme)),
    );
  });
}

async function carregarEstatisticas() {
  const stats = await api.estatisticas();
  $('stat-total').textContent = stats.total;
  $('stat-assistidos').textContent = stats.assistidos;
  $('stat-pendentes').textContent = stats.paraAssistir;
  $('stat-nota').textContent = stats.notaMedia ?? '–';
}

async function carregarFilmes() {
  try {
    const filmes = await api.listar({
      busca: filtros.busca.value.trim(),
      genero: filtros.genero.value,
      assistido: filtros.assistido.value,
    });
    desenharTabela(filmes);
    await carregarEstatisticas();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

async function excluirFilme(filme) {
  if (!confirm(`Excluir "${filme.titulo}" do catálogo?`)) return;
  try {
    await api.excluir(filme.id);
    if (campos.id.value === String(filme.id)) limparFormulario();
    mostrarMensagem(`"${filme.titulo}" foi excluído.`);
    carregarFilmes();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = lerFormulario();
  const id = campos.id.value;

  try {
    if (id) {
      await api.atualizar(id, dados);
      mostrarMensagem('Título atualizado com sucesso.');
    } else {
      await api.criar(dados);
      mostrarMensagem('Título cadastrado com sucesso.');
    }
    limparFormulario();
    carregarFilmes();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
});

$('btn-cancelar').addEventListener('click', limparFormulario);
campos.assistido.addEventListener('change', atualizarCampoNota);

// Filtros: selects recarregam na hora; a busca espera o usuário parar de digitar.
filtros.genero.addEventListener('change', carregarFilmes);
filtros.assistido.addEventListener('change', carregarFilmes);
filtros.busca.addEventListener('input', () => {
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(carregarFilmes, 300);
});
$('form-filtros').addEventListener('submit', (evento) => evento.preventDefault());

async function iniciar() {
  campos.ano.max = new Date().getFullYear() + 5;
  try {
    const { tipos, generos } = await api.opcoes();
    preencherSelect(campos.tipo, tipos);
    campos.genero.add(new Option('Selecione...', ''));
    preencherSelect(campos.genero, generos);
    preencherSelect(filtros.genero, generos);
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
    return;
  }
  carregarFilmes();
}

iniciar();
