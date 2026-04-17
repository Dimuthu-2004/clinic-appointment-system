const User = require('../models/User');

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const isExpoPushToken = (token = '') => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(String(token));

const prunePushToken = async (token) => {
  if (!token) {
    return;
  }

  await User.updateMany(
    { 'pushTokens.token': token },
    {
      $pull: {
        pushTokens: { token },
      },
    }
  );
};

const sendExpoPushMessages = async (messages) => {
  if (!messages.length || typeof fetch !== 'function') {
    return;
  }

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json().catch(() => null);
    const tickets = Array.isArray(result?.data) ? result.data : [];

    await Promise.all(
      tickets.map((ticket, index) =>
        ticket?.details?.error === 'DeviceNotRegistered'
          ? prunePushToken(messages[index]?.to)
          : Promise.resolve()
      )
    );
  } catch (error) {
    console.warn('Push notification send failed:', error.message);
  }
};

const sendPushNotificationToUser = async ({ userId, title, message, data = {} }) => {
  if (!userId || !title || !message) {
    return;
  }

  const user = await User.findById(userId).select('pushTokens');
  const pushTokens = (user?.pushTokens || []).filter((item) => isExpoPushToken(item.token));

  if (!pushTokens.length) {
    return;
  }

  await sendExpoPushMessages(
    pushTokens.map((item) => ({
      to: item.token,
      sound: 'default',
      title,
      body: message,
      data,
    }))
  );
};

module.exports = {
  isExpoPushToken,
  prunePushToken,
  sendPushNotificationToUser,
};
