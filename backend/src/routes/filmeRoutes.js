// Mapeamento dos endpoints HTTP para as funções do controller.
const { Router } = require('express');
const controller = require('../controllers/filmeController');

const router = Router();

// Rotas fixas vêm antes de "/:id" para não serem confundidas com um id.
router.get('/opcoes', controller.opcoes);
router.get('/estatisticas', controller.estatisticas);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.excluir);

module.exports = router;
