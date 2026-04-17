const express = require('express');
const userController = require('../controllers/user.controller');
const validateRequest = require('../middleware/validate.middleware');
const { authorize } = require('../middleware/auth.middleware');
const {
  listUsersValidation,
  userIdValidation,
  createUserValidation,
  updateUserValidation,
} = require('../validations/user.validation');

const router = express.Router();

router.get('/', listUsersValidation, validateRequest, userController.listUsers);
router.post('/', authorize('admin'), createUserValidation, validateRequest, userController.createUser);
router.get('/:id', authorize('admin'), userIdValidation, validateRequest, userController.getUserById);
router.put('/:id', authorize('admin'), updateUserValidation, validateRequest, userController.updateUser);
router.delete('/:id', authorize('admin'), userIdValidation, validateRequest, userController.deleteUser);

module.exports = router;
