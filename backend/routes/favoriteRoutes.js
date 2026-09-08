const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
    addToFavoritesSchema,
    removeFromFavoritesSchema,
    listFavoritesQuerySchema,
    createOrderFromFavoritesSchema
} = require('../middlewares/validations/favoriteValidations');

router.get('/get-favorites', authenticate, authorize('user'), validate(listFavoritesQuerySchema, 'query'), favoriteController.getFavorites);
router.post('/add-favorite', authenticate, authorize('user'), validate(addToFavoritesSchema, 'body'), favoriteController.addToFavorites);
router.delete('/delete-favorite', authenticate, authorize('user'), validate(removeFromFavoritesSchema, 'body'), favoriteController.removeFromFavorites);
router.post( '/create-order', authenticate, authorize('user'), validate(createOrderFromFavoritesSchema, 'body'), favoriteController.createOrderFromFavorites);

module.exports = router;
