if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const app = require('./app');
const connectDatabase = require('./config/db');

const PORT = process.env.PORT || 5000;
const DB_RETRY_DELAY_MS = 5000;

console.log(`Starting backend with NODE_ENV=${process.env.NODE_ENV || 'undefined'} PORT=${PORT}`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
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
