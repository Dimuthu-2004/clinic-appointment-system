const express = require('express');
const appSettingsController = require('../controllers/appSettings.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/clinic-config', appSettingsController.getClinicConfig);
router.put('/clinic-config', protect, appSettingsController.updateClinicSchedule);
router.put('/appointment-fee', protect, appSettingsController.updateAppointmentFee);

module.exports = router;
