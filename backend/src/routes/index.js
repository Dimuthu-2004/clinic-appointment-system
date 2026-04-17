const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const appointmentRoutes = require('./appointment.routes');
const billingRoutes = require('./billing.routes');
const medicalRecordRoutes = require('./medicalRecord.routes');
const prescriptionRoutes = require('./prescription.routes');
const alertRoutes = require('./alert.routes');
const reviewRoutes = require('./review.routes');
const drugRoutes = require('./drug.routes');
const doctorAvailabilityRoutes = require('./doctorAvailability.routes');
const paymentRoutes = require('./payment.routes');
const notificationRoutes = require('./notification.routes');
const appSettingsRoutes = require('./appSettings.routes');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/payments', paymentRoutes);
router.use('/app-settings', appSettingsRoutes);
router.use('/users', protect, userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/billings', protect, billingRoutes);
router.use('/medical-records', protect, medicalRecordRoutes);
router.use('/prescriptions', protect, prescriptionRoutes);
router.use('/alerts', protect, alertRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', protect, notificationRoutes);
router.use('/drugs', protect, drugRoutes);
router.use('/doctor-availability', protect, doctorAvailabilityRoutes);

module.exports = router;
