// Endpoints que consultam a Tabela FIPE em cascata: marcas -> modelos -> anos -> valor.
// :tipo pode ser carros, motos ou caminhoes.
const { Router } = require('express');
const controller = require('../controllers/fipeController');

const router = Router();

router.get('/:tipo/marcas', controller.marcas);
router.get('/:tipo/marcas/:marca/modelos', controller.modelos);
router.get('/:tipo/marcas/:marca/modelos/:modelo/anos', controller.anos);
router.get('/:tipo/marcas/:marca/modelos/:modelo/anos/:ano', controller.valor);

module.exports = router;
