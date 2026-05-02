require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');

const PORT = process.env.PORT || 5000;
const DB_RETRY_DELAY_MS = 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const startDatabase = async () => {
  try {
    await connectDatabase();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Failed to connect to database', error);
    console.log(`Retrying database connection in ${DB_RETRY_DELAY_MS / 1000} seconds...`);
    setTimeout(startDatabase, DB_RETRY_DELAY_MS);
  }
};

startDatabase();
