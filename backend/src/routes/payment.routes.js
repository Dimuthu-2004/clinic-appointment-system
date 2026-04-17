const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/paypal/billings/:id/order', protect, paymentController.createPaypalOrderForBilling);
router.get('/paypal/return', paymentController.handlePaypalReturn);
router.get('/paypal/cancel', paymentController.handlePaypalCancel);

module.exports = router;
