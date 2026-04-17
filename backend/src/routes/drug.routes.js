const express = require('express');
const drugController = require('../controllers/drug.controller');
const { drugImageUpload } = require('../middleware/upload.middleware');
const validateRequest = require('../middleware/validate.middleware');
const {
  drugIdValidation,
  createDrugValidation,
  updateDrugValidation,
} = require('../validations/drug.validation');

const router = express.Router();

router
  .route('/')
  .get(drugController.getDrugs)
  .post(createDrugValidation, validateRequest, drugController.createDrug);

router
  .route('/:id')
  .get(drugIdValidation, validateRequest, drugController.getDrugById)
  .put(updateDrugValidation, validateRequest, drugController.updateDrug)
  .delete(drugIdValidation, validateRequest, drugController.deleteDrug);

router.post('/:id/image', drugIdValidation, validateRequest, drugImageUpload.single('image'), drugController.uploadDrugImage);

module.exports = router;
