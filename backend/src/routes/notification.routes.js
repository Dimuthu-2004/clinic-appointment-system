const express = require('express');
const notificationController = require('../controllers/notification.controller');
const validateRequest = require('../middleware/validate.middleware');
const { notificationIdValidation } = require('../validations/notification.validation');

const router = express.Router();

router.get('/unread-count', notificationController.getUnreadNotificationCount);
router.patch('/read-all', notificationController.markAllNotificationsRead);
router.post('/push-token', notificationController.registerPushToken);
router.delete('/push-token', notificationController.unregisterPushToken);

router.route('/').get(notificationController.getNotifications);

router.patch(
  '/:id/read',
  notificationIdValidation,
  validateRequest,
  notificationController.markNotificationRead
);

module.exports = router;
