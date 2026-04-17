const fs = require('fs');
const path = require('path');
const Drug = require('../models/Drug');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { DRUG_MANAGER_ROLES } = require('../utils/roles');

const removeDrugImage = (imageUrl) => {
  if (!imageUrl) {
    return;
  }

  const imagePath = path.join(__dirname, '../../', imageUrl);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

const createDrug = asyncHandler(async (req, res) => {
  if (!DRUG_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only pharmacists or admins can create drug inventory items');
  }

  const drug = await Drug.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Drug inventory item created successfully',
    data: drug,
  });
});

const getDrugs = asyncHandler(async (req, res) => {
  if (!['doctor', ...DRUG_MANAGER_ROLES].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have access to the drug inventory');
  }

  const drugs = await Drug.find().sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: drugs.length,
    data: drugs,
  });
});

const getDrugById = asyncHandler(async (req, res) => {
  if (!['doctor', ...DRUG_MANAGER_ROLES].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have access to the drug inventory');
  }

  const drug = await Drug.findById(req.params.id);

  if (!drug) {
    throw new ApiError(404, 'Drug inventory item not found');
  }

  res.status(200).json({
    success: true,
    data: drug,
  });
});

const updateDrug = asyncHandler(async (req, res) => {
  if (!DRUG_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only pharmacists or admins can update drug inventory items');
  }

  const drug = await Drug.findById(req.params.id);

  if (!drug) {
    throw new ApiError(404, 'Drug inventory item not found');
  }

  Object.keys(req.body).forEach((field) => {
    if (req.body[field] !== undefined) {
      drug[field] = req.body[field];
    }
  });

  await drug.save();

  res.status(200).json({
    success: true,
    message: 'Drug inventory item updated successfully',
    data: drug,
  });
});

const deleteDrug = asyncHandler(async (req, res) => {
  if (!DRUG_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only pharmacists or admins can delete drug inventory items');
  }

  const drug = await Drug.findById(req.params.id);

  if (!drug) {
    throw new ApiError(404, 'Drug inventory item not found');
  }

  removeDrugImage(drug.imageUrl);
  await drug.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Drug inventory item deleted successfully',
  });
});

const uploadDrugImage = asyncHandler(async (req, res) => {
  if (!DRUG_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only pharmacists or admins can upload drug photos');
  }

  const drug = await Drug.findById(req.params.id);

  if (!drug) {
    throw new ApiError(404, 'Drug inventory item not found');
  }

  if (!req.file) {
    throw new ApiError(400, 'A drug photo is required');
  }

  removeDrugImage(drug.imageUrl);
  drug.imageUrl = path.join('uploads', 'drugs', req.file.filename).replace(/\\/g, '/');
  await drug.save();

  res.status(200).json({
    success: true,
    message: 'Drug photo uploaded successfully',
    data: drug,
  });
});

module.exports = {
  createDrug,
  getDrugs,
  getDrugById,
  updateDrug,
  deleteDrug,
  uploadDrugImage,
};
