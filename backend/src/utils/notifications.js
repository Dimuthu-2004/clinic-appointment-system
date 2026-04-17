const Notification = require('../models/Notification');
const Billing = require('../models/Billing');
const { getPaymentDueWindowMinutes } = require('./appointmentBilling');
const { sendPushNotificationToUser } = require('./pushNotifications');

const dateTimeFormatter = new Intl.DateTimeFormat('en-LK', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatNotificationDateTime = (value) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return dateTimeFormatter.format(parsed);
};

const createNotification = async ({
  recipientId,
  createdBy = null,
  type = 'general',
  title,
  message,
  entityModel = '',
  entityId = null,
  metadata = {},
}) => {
  if (!recipientId || !title || !message) {
    return null;
  }

  const notification = await Notification.create({
    recipient: recipientId,
    createdBy,
    type,
    title,
    message,
    entityModel,
    entityId,
    metadata,
  });

  await sendPushNotificationToUser({
    userId: recipientId,
    title,
    message,
    data: {
      notificationId: String(notification._id),
      type,
      entityModel,
      entityId: entityId ? String(entityId) : '',
      ...Object.fromEntries(
        Object.entries(metadata || {}).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)])
      ),
    },
  });

  return notification;
};

const ensurePendingPaymentReminderNotifications = async (patientId = null) => {
  const filter = {
    status: 'pending',
    dueDate: { $ne: null },
  };

  if (patientId) {
    filter.patient = patientId;
  }

  const dueSoonThresholdMinutes = Math.max(5, Math.floor(getPaymentDueWindowMinutes() / 2));
  const now = Date.now();
  const pendingBillings = await Billing.find(filter).select('patient amount currency dueDate');

  for (const billing of pendingBillings) {
    const dueAt = new Date(billing.dueDate).getTime();

    if (Number.isNaN(dueAt)) {
      continue;
    }

    const remainingMinutes = (dueAt - now) / 60000;
    let reminderStage = '';
    let title = '';
    let message = '';

    if (remainingMinutes <= 0) {
      reminderStage = 'overdue';
      title = 'Payment overdue';
      message = 'Your appointment payment is overdue. Please complete it as soon as possible.';
    } else if (remainingMinutes <= dueSoonThresholdMinutes) {
      reminderStage = 'due_soon';
      title = 'Pending payment reminder';
      message = `Your appointment payment is due within ${Math.ceil(remainingMinutes)} minute(s).`;
    }

    if (!reminderStage) {
      continue;
    }

    const existingReminder = await Notification.findOne({
      recipient: billing.patient,
      entityModel: 'Billing',
      entityId: billing._id,
      type: 'payment',
      'metadata.reminderStage': reminderStage,
    }).select('_id');

    if (existingReminder) {
      continue;
    }

    await createNotification({
      recipientId: billing.patient,
      type: 'payment',
      title,
      message,
      entityModel: 'Billing',
      entityId: billing._id,
      metadata: {
        reminderStage,
        amount: billing.amount,
        currency: billing.currency,
        dueDate: billing.dueDate,
      },
    });
  }
};

module.exports = {
  createNotification,
  ensurePendingPaymentReminderNotifications,
  formatNotificationDateTime,
};
