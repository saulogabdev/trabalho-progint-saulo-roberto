// Manipulação do DOM e eventos da tela. Não conhece URLs: tudo passa pelo api.js.
const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR');

// Mesma regra do backend: 3 letras, 1 número, 1 letra, 2 números.
const REGEX_PLACA = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const REGEX_PLACA_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;

const form = $('form-manutencao');
const campos = {
  id: $('id'),
  placa: $('placa'),
  tipoServico: $('tipo-servico'),
  km: $('km'),
  data: $('data'),
  custo: $('custo'),
  oficina: $('oficina'),
  observacoes: $('observacoes'),
};
const fipeSel = {
  tipo: $('tipo-veiculo'),
  marca: $('marca'),
  modelo: $('modelo'),
  ano: $('ano'),
};
const filtros = {
  placa: $('filtro-placa'),
  tipoServico: $('filtro-servico'),
};

let veiculoFipe = null; // veículo escolhido na cascata FIPE (ou carregado de uma manutenção)
let veiculos = []; // resumo por placa vindo do backend
let temporizadorMensagem;
let temporizadorBusca;

// ---------- utilitários ----------

function mostrarMensagem(texto, tipo = 'sucesso') {
  const caixa = $('mensagem');
  caixa.textContent = texto;
  caixa.className = `mensagem ${tipo}`;
  clearTimeout(temporizadorMensagem);
  temporizadorMensagem = setTimeout(() => {
    caixa.textContent = '';
    caixa.className = 'mensagem';
  }, 6000);
}

function hoje() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 10);
}

const formatarData = (iso) => iso.split('-').reverse().join('/');
const normalizarPlaca = (texto) => texto.toUpperCase().replace(/[^A-Z0-9]/g, '');

function elemento(tag, texto, classe) {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto; // textContent evita injeção de HTML
  if (classe) el.className = classe;
  return el;
}

function criarBotao(texto, rotulo, classe, aoClicar) {
  const botao = elemento('button', texto, `btn ${classe}`);
  botao.type = 'button';
  botao.setAttribute('aria-label', rotulo);
  botao.addEventListener('click', aoClicar);
  return botao;
}

// ---------- validação da placa enquanto digita ----------

// Converte uma placa antiga para Mercosul: o 2º número vira letra (0=A, 1=B, ... 9=J).
function placaAntigaParaMercosul(placa) {
  return placa.slice(0, 4) + String.fromCharCode(65 + Number(placa[4])) + placa.slice(5);
}

function validarPlacaNaTela() {
  const placa = campos.placa.value;
  const ajuda = $('ajuda-placa');
  ajuda.className = 'ajuda';
  campos.placa.removeAttribute('aria-invalid');

  if (!placa) {
    ajuda.textContent = '3 letras, 1 número, 1 letra e 2 números.';
  } else if (REGEX_PLACA.test(placa)) {
    ajuda.textContent = '✓ Placa válida no padrão Mercosul';
    ajuda.classList.add('ok');
  } else if (REGEX_PLACA_ANTIGA.test(placa)) {
    ajuda.textContent = `Placa no padrão antigo. No Mercosul ela fica ${placaAntigaParaMercosul(placa)}.`;
    ajuda.classList.add('invalido');
    campos.placa.setAttribute('aria-invalid', 'true');
  } else if (placa.length >= 7) {
    ajuda.textContent = '✗ Formato inválido. Exemplo: BRA2E19';
    ajuda.classList.add('invalido');
    campos.placa.setAttribute('aria-invalid', 'true');
  } else {
    ajuda.textContent = 'Continue digitando: 3 letras, 1 número, 1 letra e 2 números.';
  }
}

// ---------- cascata FIPE: marca -> modelo -> ano -> valor ----------

function resetarSelect(select, texto) {
  select.innerHTML = '';
  select.add(new Option(texto, ''));
  select.disabled = true;
}

function preencherOpcoes(select, lista, textoInicial) {
  select.innerHTML = '';
  select.add(new Option(textoInicial, ''));
  lista.forEach((item) => select.add(new Option(item.nome, item.codigo)));
  select.disabled = false;
}

function avisoFipe(texto) {
  const caixa = $('fipe-info');
  caixa.replaceChildren(elemento('span', texto));
  caixa.className = 'fipe-info campo-largo aviso';
  caixa.hidden = false;
}

// Cada função confere, depois da resposta, se o usuário não mudou a seleção enquanto esperava.
async function encherMarcas(tipo) {
  resetarSelect(fipeSel.marca, 'Carregando marcas...');
  resetarSelect(fipeSel.modelo, 'Selecione a marca primeiro');
  resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  try {
    const lista = await api.fipe.marcas(tipo);
    if (fipeSel.tipo.value !== tipo) return false;
    preencherOpcoes(fipeSel.marca, lista, 'Selecione a marca');
    return true;
  } catch (erro) {
    resetarSelect(fipeSel.marca, 'FIPE indisponível');
    avisoFipe(`${erro.message} Você ainda pode registrar a manutenção sem os dados do veículo.`);
    return false;
  }
}

async function encherModelos(tipo, marca) {
  resetarSelect(fipeSel.modelo, 'Carregando modelos...');
  resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  try {
    const lista = await api.fipe.modelos(tipo, marca);
    if (fipeSel.tipo.value !== tipo || fipeSel.marca.value !== marca) return false;
    preencherOpcoes(fipeSel.modelo, lista, 'Selecione o modelo');
    return true;
  } catch (erro) {
    resetarSelect(fipeSel.modelo, 'Erro ao carregar');
    avisoFipe(erro.message);
    return false;
  }
}

async function encherAnos(tipo, marca, modelo) {
  resetarSelect(fipeSel.ano, 'Carregando anos...');
  try {
    const lista = await api.fipe.anos(tipo, marca, modelo);
    if (fipeSel.marca.value !== marca || fipeSel.modelo.value !== modelo) return false;
    preencherOpcoes(fipeSel.ano, lista, 'Selecione o ano');
    return true;
  } catch (erro) {
    resetarSelect(fipeSel.ano, 'Erro ao carregar');
    avisoFipe(erro.message);
    return false;
  }
}

async function consultarValor() {
  const tipo = fipeSel.tipo.value;
  const marca = fipeSel.marca.value;
  const modelo = fipeSel.modelo.value;
  const ano = fipeSel.ano.value;
  definirVeiculo(null);
  if (!ano) return;

  avisoFipe('Consultando valor na Tabela FIPE...');
  try {
    const v = await api.fipe.valor(tipo, marca, modelo, ano);
    if (fipeSel.ano.value !== ano || fipeSel.modelo.value !== modelo) return;
    definirVeiculo({
      tipoVeiculo: tipo,
      marcaCodigo: marca,
      marca: v.marca,
      modeloCodigo: modelo,
      modelo: v.modelo,
      anoCodigo: ano,
      anoModelo: fipeSel.ano.selectedOptions[0].textContent,
      codigoFipe: v.codigoFipe,
      valorFipe: v.valor,
      mesReferencia: v.mesReferencia,
    });
  } catch (erro) {
    avisoFipe(erro.message);
  }
}

function definirVeiculo(veiculo) {
  veiculoFipe = veiculo;
  desenharFipeInfo();
}

// Caixa com o veículo escolhido, o valor FIPE e quanto já foi gasto com essa placa.
function desenharFipeInfo() {
  const caixa = $('fipe-info');
  if (!veiculoFipe) {
    caixa.hidden = true;
    caixa.replaceChildren();
    return;
  }

  const v = veiculoFipe;
  const titulo = elemento('strong', `${v.marca} ${v.modelo}`);
  const detalhes = elemento('span', `${v.anoModelo} · Código FIPE ${v.codigoFipe}`);
  const valor = elemento('span', `Valor FIPE: ${moeda.format(v.valorFipe)}`, 'destaque');
  if (v.mesReferencia) valor.textContent += ` (referência: ${v.mesReferencia})`;
  caixa.replaceChildren(titulo, detalhes, valor);

  const resumo = veiculos.find((r) => r.placa === campos.placa.value);
  if (resumo) {
    const percentual = ((resumo.totalGasto / v.valorFipe) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    caixa.append(elemento('span',
      `Gastos registrados para ${resumo.placa}: ${moeda.format(resumo.totalGasto)} = ${percentual}% do valor FIPE`));
  }

  caixa.className = 'fipe-info campo-largo';
  caixa.hidden = false;
}

// Preenche a cascata com um veículo já salvo (ao editar ou ao digitar uma placa conhecida).
// Copia só os campos FIPE, para não misturar com os dados do serviço.
async function aplicarVeiculo(v) {
  definirVeiculo({
    tipoVeiculo: v.tipoVeiculo,
    marcaCodigo: v.marcaCodigo,
    marca: v.marca,
    modeloCodigo: v.modeloCodigo,
    modelo: v.modelo,
    anoCodigo: v.anoCodigo,
    anoModelo: v.anoModelo,
    codigoFipe: v.codigoFipe,
    valorFipe: v.valorFipe,
  });
  fipeSel.tipo.value = v.tipoVeiculo;
  if (!(await encherMarcas(v.tipoVeiculo))) return;
  fipeSel.marca.value = v.marcaCodigo;
  if (!(await encherModelos(v.tipoVeiculo, v.marcaCodigo))) return;
  fipeSel.modelo.value = v.modeloCodigo;
  if (!(await encherAnos(v.tipoVeiculo, v.marcaCodigo, v.modeloCodigo))) return;
  fipeSel.ano.value = v.anoCodigo;
}

// ---------- formulário ----------

function lerFormulario() {
  const dados = {
    placa: campos.placa.value,
    tipoServico: campos.tipoServico.value,
    km: campos.km.value,
    data: campos.data.value,
    custo: campos.custo.value,
    oficina: campos.oficina.value,
    observacoes: campos.observacoes.value,
  };
  if (veiculoFipe) {
    const { mesReferencia, ...veiculo } = veiculoFipe;
    Object.assign(dados, veiculo);
  }
  return dados;
}

async function limparFormulario() {
  const tipoAntes = fipeSel.tipo.value;
  const marcasCarregadas = fipeSel.marca.options.length > 1;
  form.reset();
  campos.id.value = '';
  campos.data.value = hoje();
  definirVeiculo(null);
  validarPlacaNaTela();

  $('titulo-form').textContent = 'Registrar manutenção';
  $('btn-salvar').textContent = 'Registrar manutenção';
  $('btn-cancelar').hidden = true;

  if (tipoAntes !== fipeSel.tipo.value || !marcasCarregadas) {
    await encherMarcas(fipeSel.tipo.value);
  } else {
    fipeSel.marca.value = '';
    resetarSelect(fipeSel.modelo, 'Selecione a marca primeiro');
    resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  }
}

function iniciarEdicao(m) {
  campos.id.value = m.id;
  campos.placa.value = m.placa;
  campos.tipoServico.value = m.tipoServico;
  campos.km.value = m.km;
  campos.data.value = m.data;
  campos.custo.value = m.custo;
  campos.oficina.value = m.oficina;
  campos.observacoes.value = m.observacoes ?? '';
  validarPlacaNaTela();

  if (m.codigoFipe) {
    aplicarVeiculo(m);
  } else {
    definirVeiculo(null);
    fipeSel.marca.value = '';
    resetarSelect(fipeSel.modelo, 'Selecione a marca primeiro');
    resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  }

  $('titulo-form').textContent = `Editando: ${m.tipoServico} · ${m.placa} · ${formatarData(m.data)}`;
  $('btn-salvar').textContent = 'Salvar alterações';
  $('btn-cancelar').hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
  campos.placa.focus();
}

// ---------- tabelas ----------

function desenharResumo() {
  const manutencoes = veiculos.reduce((soma, v) => soma + v.quantidade, 0);
  const total = veiculos.reduce((soma, v) => soma + v.totalGasto, 0);
  $('stat-veiculos').textContent = veiculos.length;
  $('stat-manutencoes').textContent = manutencoes;
  $('stat-total').textContent = moeda.format(total);
  $('stat-media').textContent = moeda.format(manutencoes ? total / manutencoes : 0);
}

function barraPercentual(percentual) {
  if (percentual === null) return elemento('span', '—', 'suave');

  const caixa = elemento('div', undefined, 'percentual');
  const nivel = percentual < 10 ? 'baixo' : percentual < 30 ? 'medio' : 'alto';
  const barra = elemento('div', undefined, 'barra');
  const preenchimento = elemento('div', undefined, `preenchimento ${nivel}`);
  preenchimento.style.width = `${Math.min(percentual, 100)}%`;
  barra.appendChild(preenchimento);
  caixa.append(barra, elemento('span', `${percentual.toLocaleString('pt-BR')}%`));
  return caixa;
}

function desenharVeiculos() {
  const corpo = $('tabela-veiculos');
  corpo.innerHTML = '';
  $('vazio-veiculos').hidden = veiculos.length > 0;

  veiculos.forEach((r) => {
    const linha = corpo.insertRow();
    linha.insertCell().appendChild(elemento('span', r.placa, 'placa-tag'));

    const celulaVeiculo = linha.insertCell();
    if (r.veiculo) {
      celulaVeiculo.append(
        elemento('strong', `${r.veiculo.marca} ${r.veiculo.modelo}`),
        elemento('small', r.veiculo.anoModelo, 'linha-extra'),
      );
    } else {
      celulaVeiculo.appendChild(elemento('span', 'Sem dados FIPE', 'suave'));
    }

    linha.insertCell().textContent = r.quantidade;
    linha.insertCell().textContent = `${numero.format(r.kmAtual)} km`;
    linha.insertCell().textContent = moeda.format(r.totalGasto);
    linha.insertCell().textContent = r.veiculo ? moeda.format(r.veiculo.valorFipe) : '—';
    linha.insertCell().appendChild(barraPercentual(r.percentualFipe));

    linha.insertCell().appendChild(
      criarBotao('Ver histórico', `Ver histórico da placa ${r.placa}`, 'btn-secundario', () => {
        filtros.placa.value = r.placa;
        carregarManutencoes();
        $('titulo-lista').scrollIntoView({ behavior: 'smooth' });
      }),
    );
  });
}

function desenharManutencoes(lista) {
  const corpo = $('tabela-manutencoes');
  corpo.innerHTML = '';
  $('vazio-manutencoes').hidden = lista.length > 0;

  lista.forEach((m) => {
    const linha = corpo.insertRow();
    linha.insertCell().textContent = formatarData(m.data);
    linha.insertCell().appendChild(elemento('span', m.placa, 'placa-tag'));

    const celulaServico = linha.insertCell();
    celulaServico.appendChild(elemento('strong', m.tipoServico));
    if (m.observacoes) celulaServico.appendChild(elemento('small', m.observacoes, 'linha-extra'));

    linha.insertCell().textContent = `${numero.format(m.km)} km`;
    linha.insertCell().textContent = m.oficina;
    linha.insertCell().textContent = moeda.format(m.custo);

    const descricao = `${m.tipoServico} da placa ${m.placa} em ${formatarData(m.data)}`;
    const acoes = linha.insertCell();
    acoes.className = 'celula-acoes';
    acoes.append(
      criarBotao('Editar', `Editar ${descricao}`, 'btn-secundario', () => iniciarEdicao(m)),
      criarBotao('Excluir', `Excluir ${descricao}`, 'btn-perigo', () => excluirManutencao(m)),
    );
  });
}

async function carregarVeiculos() {
  veiculos = await api.manutencoes.veiculos();
  desenharResumo();
  desenharVeiculos();
  desenharFipeInfo();
}

async function carregarManutencoes() {
  const lista = await api.manutencoes.listar({
    placa: normalizarPlaca(filtros.placa.value),
    tipoServico: filtros.tipoServico.value,
  });
  desenharManutencoes(lista);
}

async function carregarTudo() {
  try {
    await Promise.all([carregarVeiculos(), carregarManutencoes()]);
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

async function excluirManutencao(m) {
  if (!confirm(`Excluir a manutenção "${m.tipoServico}" da placa ${m.placa} em ${formatarData(m.data)}?`)) return;
  try {
    await api.manutencoes.excluir(m.id);
    if (campos.id.value === String(m.id)) await limparFormulario();
    mostrarMensagem('Manutenção excluída.');
    carregarTudo();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

// ---------- eventos ----------

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  if (fipeSel.marca.value && !veiculoFipe) {
    mostrarMensagem('Termine de escolher o veículo (marca, modelo e ano) ou deixe a marca em branco.', 'erro');
    return;
  }

  const dados = lerFormulario();
  const id = campos.id.value;
  try {
    if (id) {
      await api.manutencoes.atualizar(id, dados);
      mostrarMensagem('Manutenção atualizada com sucesso.');
    } else {
      await api.manutencoes.criar(dados);
      mostrarMensagem('Manutenção registrada com sucesso.');
    }
    await limparFormulario();
    carregarTudo();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
});

$('btn-cancelar').addEventListener('click', limparFormulario);

campos.placa.addEventListener('input', () => {
  campos.placa.value = normalizarPlaca(campos.placa.value);
  validarPlacaNaTela();
});

// Placa já conhecida: preenche o veículo com os dados FIPE da última manutenção dela.
campos.placa.addEventListener('change', () => {
  const conhecido = veiculos.find((r) => r.placa === campos.placa.value);
  if (conhecido?.veiculo && !veiculoFipe && !fipeSel.marca.value) {
    aplicarVeiculo(conhecido.veiculo);
  } else {
    desenharFipeInfo();
  }
});

fipeSel.tipo.addEventListener('change', () => {
  definirVeiculo(null);
  encherMarcas(fipeSel.tipo.value);
});
fipeSel.marca.addEventListener('change', () => {
  definirVeiculo(null);
  if (fipeSel.marca.value) {
    encherModelos(fipeSel.tipo.value, fipeSel.marca.value);
  } else {
    resetarSelect(fipeSel.modelo, 'Selecione a marca primeiro');
    resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  }
});
fipeSel.modelo.addEventListener('change', () => {
  definirVeiculo(null);
  if (fipeSel.modelo.value) {
    encherAnos(fipeSel.tipo.value, fipeSel.marca.value, fipeSel.modelo.value);
  } else {
    resetarSelect(fipeSel.ano, 'Selecione o modelo primeiro');
  }
});
fipeSel.ano.addEventListener('change', consultarValor);

// Filtros: o select recarrega na hora; a placa espera o usuário parar de digitar.
filtros.tipoServico.addEventListener('change', carregarManutencoes);
filtros.placa.addEventListener('input', () => {
  filtros.placa.value = normalizarPlaca(filtros.placa.value);
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(carregarManutencoes, 300);
});
$('form-filtros').addEventListener('submit', (evento) => evento.preventDefault());

async function iniciar() {
  campos.data.value = hoje();
  campos.data.max = hoje();
  try {
    const { tiposServico } = await api.manutencoes.opcoes();
    campos.tipoServico.add(new Option('Selecione...', ''));
    tiposServico.forEach((t) => {
      campos.tipoServico.add(new Option(t, t));
      filtros.tipoServico.add(new Option(t, t));
    });
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
    return;
  }
  carregarTudo();
  encherMarcas(fipeSel.tipo.value);
}

iniciar();
