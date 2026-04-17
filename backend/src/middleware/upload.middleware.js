const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const medicalRecordMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const createUpload = ({ directoryName, allowedMimeTypes, fileSize, files = 1 }) => {
  const uploadDirectory = path.join(__dirname, `../../uploads/${directoryName}`);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDirectory, { recursive: true });
      cb(null, uploadDirectory);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/\s+/g, '-');
      cb(null, `${Date.now()}-${safeName}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Unsupported file type'));
    }

    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize,
      files,
    },
  });
};

const medicalRecordUpload = createUpload({
  directoryName: 'medical-records',
  allowedMimeTypes: medicalRecordMimeTypes,
  fileSize: 5 * 1024 * 1024,
  files: 3,
});

const drugImageUpload = createUpload({
  directoryName: 'drugs',
  allowedMimeTypes: imageMimeTypes,
  fileSize: 3 * 1024 * 1024,
  files: 1,
});

module.exports = {
  drugImageUpload,
  medicalRecordUpload,
};
