const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
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

const hasExactKeyPattern = (index = {}, expected = {}) => {
  const leftEntries = Object.entries(index.key || {});
  const rightEntries = Object.entries(expected);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return rightEntries.every(([key, value]) => index.key?.[key] === value);
};

const ensureAppointmentCollectionState = async () => {
  const collection = Appointment.collection;
  const indexes = await collection.indexes();

  for (const index of indexes) {
    if (index.name === '_id_') {
      continue;
    }

    // Clean up legacy unique indexes such as { doctor: 1 } that block
    // creating more than one appointment for the same doctor.
    if (index.unique && hasExactKeyPattern(index, { doctor: 1 })) {
      await collection.dropIndex(index.name);
    }
  }

  await collection.createIndex(
    { doctor: 1, appointmentDate: 1, appointmentSession: 1, tokenNumber: 1 },
    {
      unique: true,
      partialFilterExpression: {
        tokenNumber: { $type: 'number' },
      },
      name: 'doctor_1_appointmentDate_1_appointmentSession_1_tokenNumber_1',
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
    await ensureAppointmentCollectionState();
    console.log('MongoDB connected');
  } catch (error) {
    error.message = `${buildMongoConnectionHelp(mongoUri)} ${error.message}`;
    throw error;
  }
};

module.exports = connectDatabase;
