const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensurePendingPaymentReminderNotifications } = require('../utils/notifications');
const { isExpoPushToken } = require('../utils/pushNotifications');

const populateNotification = [
  { path: 'recipient', select: 'firstName lastName email' },
  { path: 'createdBy', select: 'firstName lastName role' },
];

const getNotifications = asyncHandler(async (req, res) => {
  if (req.user.role === 'patient') {
    await ensurePendingPaymentReminderNotifications(req.user._id);
  }

  const notifications = await Notification.find({ recipient: req.user._id })
    .populate(populateNotification)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: notifications.length,
    unreadCount: notifications.filter((item) => !item.isRead).length,
    data: notifications,
  });
});

const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  if (req.user.role === 'patient') {
    await ensurePendingPaymentReminderNotifications(req.user._id);
  }

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    data: {
      unreadCount,
    },
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (String(notification.recipient) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this notification');
  }

  notification.isRead = true;
  notification.readAt = notification.readAt || new Date();
  await notification.save();

  const updatedNotification = await Notification.findById(notification._id).populate(populateNotification);

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: updatedNotification,
  });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      recipient: req.user._id,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

const registerPushToken = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();

  if (!isExpoPushToken(token)) {
    throw new ApiError(422, 'Invalid Expo push token');
  }

  await User.updateMany(
    {
      _id: { $ne: req.user._id },
      'pushTokens.token': token,
    },
    {
      $pull: {
        pushTokens: { token },
      },
    }
  );

  await User.updateOne(
    {
      _id: req.user._id,
      'pushTokens.token': token,
    },
    {
      $set: {
        'pushTokens.$.platform': String(req.body.platform || '').trim(),
        'pushTokens.$.deviceName': String(req.body.deviceName || '').trim(),
        'pushTokens.$.updatedAt': new Date(),
      },
    }
  );

  const updatedUser = await User.findById(req.user._id).select('pushTokens');
  const alreadyRegistered = updatedUser.pushTokens.some((item) => item.token === token);

  if (!alreadyRegistered) {
    updatedUser.pushTokens.push({
      token,
      platform: String(req.body.platform || '').trim(),
      deviceName: String(req.body.deviceName || '').trim(),
      updatedAt: new Date(),
    });
    await updatedUser.save();
  }

  res.status(200).json({
    success: true,
    message: 'Push notifications enabled',
  });
});

const unregisterPushToken = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();

  if (!token) {
    throw new ApiError(422, 'Push token is required');
  }

  await User.updateOne(
    { _id: req.user._id },
    {
      $pull: {
        pushTokens: { token },
      },
    }
  );

  res.status(200).json({
    success: true,
    message: 'Push notifications disabled for this device',
  });
});

module.exports = {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  unregisterPushToken,
};
