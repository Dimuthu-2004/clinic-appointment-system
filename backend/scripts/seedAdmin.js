require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('../src/config/db');
const User = require('../src/models/User');
const { USER_ROLES } = require('../src/utils/roles');

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding an admin');
  }

  await connectDatabase();

  let admin = await User.findOne({ email: adminEmail.toLowerCase() }).select('+password');

  if (!admin) {
    admin = new User({
      firstName: process.env.ADMIN_FIRST_NAME || 'System',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      role: USER_ROLES.ADMIN,
      phone: process.env.ADMIN_PHONE || '0710000000',
    });
  } else {
    admin.firstName = process.env.ADMIN_FIRST_NAME || admin.firstName;
    admin.lastName = process.env.ADMIN_LAST_NAME || admin.lastName;
    admin.password = adminPassword;
    admin.role = USER_ROLES.ADMIN;
    admin.phone = process.env.ADMIN_PHONE || admin.phone;
  }

  await admin.save();
  console.log(`Admin account ready: ${admin.email}`);
  await mongoose.disconnect();
};

seedAdmin().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
