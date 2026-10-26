// Ponto de entrada: apenas inicia o servidor na porta configurada.
const app = require('./src/app');

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`RevisaCar rodando em http://localhost:${PORTA}`);
});
