const mongoose = require('mongoose');
const User = require('../models/User');

const isLocalMongoUri = (uri = '') => /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(uri);

const buildMongoConnectionHelp = (uri) => {
  if (isLocalMongoUri(uri)) {
    return [
      `MongoDB is not reachable at ${uri}.`,
      'Start a local MongoDB server, or replace MONGO_URI in backend/.env with your MongoDB Atlas connection string.',
      'If you copied backend/.env.example directly, that file uses a localhost MongoDB instance by default.',
    ].join(' ');
  }

  return `Could not connect to MongoDB using MONGO_URI=${uri}.`;
};

const ensureUserCollectionState = async () => {
  const collection = User.collection;

  await collection.updateMany(
    { nic: null },
    {
      $unset: { nic: '' },
    }
  );

  await collection.updateMany(
    { slmcRegistrationNumber: null },
    {
      $unset: { slmcRegistrationNumber: '' },
    }
  );

  await collection.updateMany(
    { googleId: null },
    {
      $unset: { googleId: '' },
    }
  );

  const indexes = await collection.indexes();
  const indexNames = new Set(indexes.map((index) => index.name));

  for (const indexName of ['googleId_1', 'nic_1', 'slmcRegistrationNumber_1']) {
    if (indexNames.has(indexName)) {
      await collection.dropIndex(indexName);
    }
  }

  await collection.createIndex(
    { nic: 1 },
    {
      unique: true,
      partialFilterExpression: {
        nic: { $type: 'string' },
      },
      name: 'nic_1',
    }
  );

  await collection.createIndex(
    { slmcRegistrationNumber: 1 },
    {
      unique: true,
      partialFilterExpression: {
        slmcRegistrationNumber: { $type: 'string' },
      },
      name: 'slmcRegistrationNumber_1',
    }
  );
};

const connectDatabase = async () => {
  mongoose.set('strictQuery', true);
  const mongoUri = process.env.MONGO_URI;

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    await ensureUserCollectionState();
    console.log('MongoDB connected');
  } catch (error) {
    error.message = `${buildMongoConnectionHelp(mongoUri)} ${error.message}`;
    throw error;
  }
};

module.exports = connectDatabase;
