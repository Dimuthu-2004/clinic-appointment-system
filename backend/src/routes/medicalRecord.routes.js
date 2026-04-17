const express = require('express');
const { param } = require('express-validator');
const medicalRecordController = require('../controllers/medicalRecord.controller');
const validateRequest = require('../middleware/validate.middleware');
const { medicalRecordUpload } = require('../middleware/upload.middleware');
const {
  medicalRecordIdValidation,
  attachmentIdValidation,
  createMedicalRecordValidation,
  updateMedicalRecordValidation,
} = require('../validations/medicalRecord.validation');

const router = express.Router();

router.get('/doctor/patients', medicalRecordController.getDoctorPatientDirectory);
router.get('/:patientId/history', [param('patientId').isMongoId().withMessage('Invalid patient id')], validateRequest, medicalRecordController.getDoctorPatientHistory);

router
  .route('/')
  .get(medicalRecordController.getMedicalRecords)
  .post(createMedicalRecordValidation, validateRequest, medicalRecordController.createMedicalRecord);

router
  .route('/:id')
  .get(medicalRecordIdValidation, validateRequest, medicalRecordController.getMedicalRecordById)
  .put(updateMedicalRecordValidation, validateRequest, medicalRecordController.updateMedicalRecord)
  .delete(medicalRecordIdValidation, validateRequest, medicalRecordController.deleteMedicalRecord);

router.patch(
  '/:id/archive',
  medicalRecordIdValidation,
  validateRequest,
  medicalRecordController.archiveMedicalRecord
);

router.post(
  '/:id/attachments',
  medicalRecordIdValidation,
  validateRequest,
  medicalRecordUpload.array('attachments', 3),
  medicalRecordController.uploadMedicalRecordAttachments
);

router.delete(
  '/:id/attachments/:attachmentId',
  attachmentIdValidation,
  validateRequest,
  medicalRecordController.deleteMedicalRecordAttachment
);

module.exports = router;
