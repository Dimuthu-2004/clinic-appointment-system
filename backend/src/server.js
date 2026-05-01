require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');

const PORT = process.env.PORT || 5000;
const DB_RETRY_DELAY_MS = 5000;
let serverStarted = false;

const startServer = async () => {
  try {
    await connectDatabase();

    if (!serverStarted) {
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });
      serverStarted = true;
    }
  } catch (error) {
    console.error('Failed to start server', error);
    console.log(`Retrying database connection in ${DB_RETRY_DELAY_MS / 1000} seconds...`);
    setTimeout(startServer, DB_RETRY_DELAY_MS);
  }
};

startServer();
