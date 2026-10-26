// Configuração do Express: middlewares, rotas da API e arquivos do frontend.
const path = require('path');
const express = require('express');
const cors = require('cors');
const filmeRoutes = require('./routes/filmeRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Log simples de cada requisição: método, caminho, status e tempo.
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
  });
  next();
});

app.use('/api/filmes', filmeRoutes);

// O backend também serve o frontend, então tudo roda com um único comando.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Rota de API inexistente.
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// JSON malformado ou erro inesperado.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
