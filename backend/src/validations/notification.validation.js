const { param } = require('express-validator');

const notificationIdValidation = [param('id').isMongoId().withMessage('Invalid notification id')];

module.exports = {
  notificationIdValidation,
};
