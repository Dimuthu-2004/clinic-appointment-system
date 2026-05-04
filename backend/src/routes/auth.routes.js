const express = require('express');
const authController = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
const {
  patientRegisterValidation,
  doctorRegisterValidation,
  staffRegisterValidation,
  loginValidation,
  googleLoginValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
  updateProfileValidation,
} = require('../validations/auth.validation');

const router = express.Router();

router.post('/register/patient', patientRegisterValidation, validateRequest, authController.registerPatient);
router.post('/register/doctor', doctorRegisterValidation, validateRequest, authController.registerDoctor);
router.post('/register/staff', staffRegisterValidation, validateRequest, authController.registerStaff);
router.post('/login', loginValidation, validateRequest, authController.login);
router.post('/google', googleLoginValidation, validateRequest, authController.googleLogin);
router.post('/forgot-password', requestPasswordResetValidation, validateRequest, authController.requestPasswordReset);
router.post('/reset-password', resetPasswordValidation, validateRequest, authController.resetPassword);
router.get('/me', protect, authController.getProfile);
router.patch('/me', protect, updateProfileValidation, validateRequest, authController.updateProfile);

module.exports = router;
