const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureResourceAccess } = require('../utils/access');
const { createNotification, formatNotificationDateTime } = require('../utils/notifications');
const { getTodayDateKey, normalizeDateKey } = require('../utils/clinicSchedule');

const populateReview = [
  { path: 'patient', select: 'firstName lastName' },
  { path: 'doctor', select: 'firstName lastName specialization' },
  { path: 'appointment', select: 'appointmentDate appointmentSession tokenNumber reason status' },
  { path: 'repliedBy', select: 'firstName lastName role' },
];

const ensureAppointmentEligibleForReview = async ({ appointmentId, patientId }) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'doctor', select: 'firstName lastName specialization role' })
    .populate({ path: 'patient', select: 'firstName lastName role' });

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (String(appointment.patient?._id || appointment.patient) !== String(patientId)) {
    throw new ApiError(403, 'You can only leave feedback for your own appointments');
  }

  if (appointment.status === 'cancelled') {
    throw new ApiError(422, 'Cancelled appointments cannot receive feedback');
  }

  if (normalizeDateKey(appointment.appointmentDate) > getTodayDateKey()) {
    throw new ApiError(422, 'Feedback can only be added after the appointment date arrives');
  }

  if (!appointment.doctor || appointment.doctor.role !== 'doctor') {
    throw new ApiError(404, 'Doctor not found for this appointment');
  }

  return appointment;
};

const createReview = asyncHandler(async (req, res) => {
  if (req.user.role !== 'patient') {
    throw new ApiError(403, 'Only patients can create feedback');
  }

  const appointment = await ensureAppointmentEligibleForReview({
    appointmentId: req.body.appointment,
    patientId: req.user._id,
  });

  const existingReview = await Review.findOne({ appointment: appointment._id });

  if (existingReview) {
    throw new ApiError(409, 'Feedback has already been added for this appointment');
  }

  const review = await Review.create({
    patient: req.user._id,
    doctor: appointment.doctor._id,
    appointment: appointment._id,
    rating: req.body.rating,
    comment: String(req.body.comment || '').trim(),
  });

  const populatedReview = await Review.findById(review._id).populate(populateReview);

  res.status(201).json({
    success: true,
    message: 'Review created successfully',
    data: populatedReview,
  });
});

const getReviews = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'doctor') {
    filter.doctor = req.user._id;
  }

  if (req.user.role === 'patient') {
    filter.patient = req.user._id;
  }

  const reviews = await Review.find(filter).populate(populateReview).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reviews.length,
    data: reviews,
  });
});

const getPublicReviews = asyncHandler(async (_req, res) => {
  const reviews = await Review.find({
    rating: { $gte: 1 },
  })
    .populate(populateReview)
    .sort({ createdAt: -1 })
    .limit(8);

  const publicReviews = reviews.map((review) => ({
    _id: review._id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    patient: {
      firstName: review.patient?.firstName || 'Patient',
      lastName: review.patient?.lastName ? `${review.patient.lastName.charAt(0)}.` : '',
    },
    doctor: review.doctor
      ? {
          firstName: review.doctor.firstName,
          lastName: review.doctor.lastName,
          specialization: review.doctor.specialization,
        }
      : null,
  }));

  res.status(200).json({
    success: true,
    count: publicReviews.length,
    data: publicReviews,
  });
});

const getReviewById = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id).populate(populateReview);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (!ensureResourceAccess(req.user, review, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this review');
  }

  res.status(200).json({
    success: true,
    data: review,
  });
});

const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (req.user.role === 'admin') {
    const nextReply = String(req.body.adminReply || '').trim();
    const previousReply = review.adminReply || '';

    review.adminReply = nextReply;
    review.repliedBy = nextReply ? req.user._id : null;
    review.repliedAt = nextReply ? new Date() : null;

    await review.save();

    if (nextReply && nextReply !== previousReply) {
      const appointmentDate = review.appointment
        ? (
            await Appointment.findById(review.appointment).select('appointmentDate')
          )?.appointmentDate
        : null;

      await createNotification({
        recipientId: review.patient,
        createdBy: req.user._id,
        type: 'feedback',
        title: 'Reply to your feedback',
        message: appointmentDate
          ? `An admin replied to your feedback for the appointment on ${formatNotificationDateTime(appointmentDate)}.`
          : 'An admin replied to your feedback.',
        entityModel: 'Review',
        entityId: review._id,
      });
    }
  } else if (String(review.patient) === String(req.user._id)) {
    if (req.body.rating !== undefined) {
      review.rating = req.body.rating;
    }

    if (req.body.comment !== undefined) {
      review.comment = String(req.body.comment || '').trim();
    }
  } else {
    throw new ApiError(403, 'You do not have access to update this review');
  }

  await review.save();

  const updatedReview = await Review.findById(review._id).populate(populateReview);

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: updatedReview,
  });
});

const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (req.user.role !== 'admin' && String(review.patient) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to delete this review');
  }

  await review.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

module.exports = {
  createReview,
  getReviews,
  getPublicReviews,
  getReviewById,
  updateReview,
  deleteReview,
};
