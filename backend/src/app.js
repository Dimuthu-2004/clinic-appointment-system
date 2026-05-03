const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();
const clientUrl = process.env.CLIENT_URL;
const corsOrigin =
  !clientUrl || clientUrl.trim() === '*'
    ? '*'
    : clientUrl
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }

  next();
});

app.use(
  cors({
    origin: corsOrigin,
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Clinic Appointment System API is running',
    health: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Clinic Appointment System API is running',
  });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
