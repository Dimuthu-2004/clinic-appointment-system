const mongoose = require('mongoose');
const User = require('../models/User');

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
  await mongoose.connect(process.env.MONGO_URI);
  await ensureUserCollectionState();
  console.log('MongoDB connected');
};

module.exports = connectDatabase;
