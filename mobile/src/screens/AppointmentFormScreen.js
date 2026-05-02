import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import DateTimeField from '../components/DateTimeField';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import {
  buildAppointmentDateForSession,
  getClinicSessionsForDate,
  getTodayDateKey,
  inferAppointmentSession,
  setClinicHours,
  toDateKey,
} from '../utils/clinicSchedule';
import { getPatientAppointmentEditState, getPatientCancellationState } from '../utils/appointmentRules';
import { paymentMethods, specializations } from '../utils/constants';
import { formatCurrency, toPickerItems } from '../utils/date';

const APPOINTMENT_FEE = {
  amount: 2500,
  currency: 'LKR',
};

export default function AppointmentFormScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const {
    user,
    pendingAppointmentBooking,
    startAppointmentBookingAuthFlow,
    clearPendingAppointmentBooking,
  } = useAuth();
  const isFocused = useIsFocused();
  const existingAppointment = route.params?.appointment;
  const isGuestBooking = !user;
  const isPatientNewBooking = (isGuestBooking || user?.role === 'patient') && !existingAppointment;
  const isPatientEditingAppointment = user?.role === 'patient' && Boolean(existingAppointment);
  const isAdminViewer = user?.role === 'admin';
  const getInitialFormState = () => ({
    patient: existingAppointment?.patient?._id || '',
    doctor: existingAppointment?.doctor?._id || '',
    appointmentDate: toDateKey(
      existingAppointment?.appointmentDate || getTodayDateKey()
    ),
    appointmentSession:
      existingAppointment?.appointmentSession || inferAppointmentSession(existingAppointment?.appointmentDate) || '',
    paymentMethod: 'paypal',
  });
  const [form, setForm] = useState({
    ...getInitialFormState(),
  });
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [adminDoctorSearch, setAdminDoctorSearch] = useState(
    existingAppointment?.doctor ? `${existingAppointment.doctor.firstName} ${existingAppointment.doctor.lastName}` : ''
  );
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [searchingDoctors, setSearchingDoctors] = useState(false);
  const [bookingPreview, setBookingPreview] = useState(null);
  const [hasSearchedDoctors, setHasSearchedDoctors] = useState(false);
  const [showDoctorResults, setShowDoctorResults] = useState(true);
  const [hasAppliedPendingBooking, setHasAppliedPendingBooking] = useState(false);
  const [skipNextPatientAvailabilityReset, setSkipNextPatientAvailabilityReset] = useState(false);
  const [appointmentFee, setAppointmentFee] = useState(APPOINTMENT_FEE);
  const [linkedBilling, setLinkedBilling] = useState(null);
  const cancellationState = existingAppointment ? getPatientCancellationState(existingAppointment) : null;
  const patientAppointmentEditState = isPatientEditingAppointment
    ? getPatientAppointmentEditState(existingAppointment, linkedBilling)
    : { canEdit: true, reason: '' };

  const resolveSelectedDoctor = () => {
    if (form.doctor) {
      return doctors.find((doctor) => doctor._id === form.doctor) || bookingPreview?.doctor || null;
    }

    const normalizedSearch = doctorSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return bookingPreview?.doctor || null;
    }

    const exactMatches = doctors.filter(
      (doctor) => `${doctor.firstName} ${doctor.lastName}`.trim().toLowerCase() === normalizedSearch
    );

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    return bookingPreview?.doctor || null;
  };

  const doctorSuggestions = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();

    if (!isPatientNewBooking || !query) {
      return [];
    }

    return doctors
      .filter((doctor) => `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [doctorSearch, doctors, isPatientNewBooking]);

  const specializationOptions = useMemo(
    () =>
      specializations.map((item) => ({
        label: item,
        value: item,
      })),
    []
  );

  const selectedDoctorFee = useMemo(() => {
    if (bookingPreview?.appointmentFee?.amount) {
      return bookingPreview.appointmentFee;
    }

    const selectedAvailableDoctor = availableDoctors.find((doctor) => doctor._id === form.doctor);

    if (selectedAvailableDoctor?.appointmentFee?.amount) {
      return selectedAvailableDoctor.appointmentFee;
    }

    const selectedDirectoryDoctor = doctors.find((doctor) => doctor._id === form.doctor);

    if (selectedDirectoryDoctor?.appointmentFee?.amount) {
      return selectedDirectoryDoctor.appointmentFee;
    }

    return appointmentFee;
  }, [appointmentFee, availableDoctors, bookingPreview, doctors, form.doctor]);

  const filteredDoctors = useMemo(() => {
    if (isPatientNewBooking) {
      return doctors;
    }

    const normalizedSearch = adminDoctorSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return doctors;
    }

    return doctors.filter((doctor) =>
      `${doctor.firstName} ${doctor.lastName}`.trim().toLowerCase().includes(normalizedSearch)
    );
  }, [adminDoctorSearch, doctors, isPatientNewBooking]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const requests = [
          api.get(isPatientNewBooking ? '/appointments/doctor-directory' : '/users?role=doctor'),
          api.get('/app-settings/clinic-config'),
        ];

        if (user?.role && user.role !== 'patient') {
          requests.push(api.get('/users?role=patient'));
        }

        const responses = await Promise.all(requests);
        setDoctors(responses[0].data.data);
        const nextHours = responses[1]?.data?.data?.clinicHours || [];
        const nextAppointmentFee = responses[1]?.data?.data?.appointmentFee;
        if (nextHours.length) {
          setClinicHours(nextHours);
        }
        if (nextAppointmentFee?.amount) {
          setAppointmentFee(nextAppointmentFee);
        }
        setPatients(responses[2]?.data?.data || []);
      } catch (error) {
        Alert.alert('Unable to load people', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [isPatientNewBooking, user?.role]);

  useEffect(() => {
    if (!isFocused || existingAppointment || route.params?.resumePendingBooking) {
      return;
    }

    setForm(getInitialFormState());
    setDoctorSearch('');
    setAdminDoctorSearch(
      existingAppointment?.doctor ? `${existingAppointment.doctor.firstName} ${existingAppointment.doctor.lastName}` : ''
    );
    setSpecializationFilter('');
    setAvailableDoctors([]);
    setBookingPreview(null);
    setHasSearchedDoctors(false);
    setShowDoctorResults(true);
    setHasAppliedPendingBooking(false);
    setSkipNextPatientAvailabilityReset(false);
  }, [existingAppointment, isFocused, route.params?.resumePendingBooking]);

  useEffect(() => {
    if (!isPatientNewBooking || !route.params?.resumePendingBooking || !pendingAppointmentBooking || loading || hasAppliedPendingBooking) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...pendingAppointmentBooking.form,
      patient: current.patient,
    }));
    setDoctorSearch(pendingAppointmentBooking.doctorSearch || '');
    setSpecializationFilter(pendingAppointmentBooking.specializationFilter || '');
    setAvailableDoctors(pendingAppointmentBooking.availableDoctors || []);
    setBookingPreview(pendingAppointmentBooking.bookingPreview || null);
    setHasSearchedDoctors(Boolean(pendingAppointmentBooking.hasSearchedDoctors));
    setShowDoctorResults(
      pendingAppointmentBooking.showDoctorResults === undefined
        ? true
        : pendingAppointmentBooking.showDoctorResults
    );
    setSkipNextPatientAvailabilityReset(true);
    setHasAppliedPendingBooking(true);
    navigation.setParams({ resumePendingBooking: undefined });
  }, [
    hasAppliedPendingBooking,
    isPatientNewBooking,
    loading,
    pendingAppointmentBooking,
    route.params?.resumePendingBooking,
  ]);

  useEffect(() => {
    if (!isPatientNewBooking) {
      return;
    }

    const normalizedSearch = doctorSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return;
    }

    const matchedDoctor = doctors.find(
      (doctor) => `${doctor.firstName} ${doctor.lastName}`.trim().toLowerCase() === normalizedSearch
    );

    if (matchedDoctor?.specialization) {
      setSpecializationFilter(matchedDoctor.specialization);
    }
  }, [doctorSearch, doctors, isPatientNewBooking]);

  useEffect(() => {
    if (isPatientNewBooking) {
      return;
    }

    const loadSessions = async () => {
      if (!form.doctor || !form.appointmentDate) {
        setSessionOptions([]);
        return;
      }

      try {
        const response = await api.get('/doctor-availability/options', {
          params: {
            doctor: form.doctor,
            date: form.appointmentDate,
          },
        });

        setSessionOptions(response.data.data.sessions || []);
      } catch (_error) {
        const fallbackSessions = getClinicSessionsForDate(form.appointmentDate).map((item) => ({
          ...item,
          isAvailable: true,
        }));
        setSessionOptions(fallbackSessions);
      }
    };

    loadSessions();
  }, [form.appointmentDate, form.doctor, isPatientNewBooking]);

  useEffect(() => {
    if (isPatientNewBooking) {
      return;
    }

    const sessionStillValid = sessionOptions.some(
      (item) => item.value === form.appointmentSession && item.isAvailable
    );

    if (sessionStillValid) {
      return;
    }

    if (sessionOptions.length > 0) {
      const firstAvailableSession = sessionOptions.find((item) => item.isAvailable);

      if (firstAvailableSession) {
        setForm((current) => ({ ...current, appointmentSession: firstAvailableSession.value }));
        return;
      }
    }

    if (form.appointmentSession) {
      setForm((current) => ({ ...current, appointmentSession: '' }));
    }
  }, [form.appointmentSession, isPatientNewBooking, sessionOptions]);

  useEffect(() => {
    const loadLinkedBilling = async () => {
      if (!existingAppointment?._id) {
        setLinkedBilling(null);
        return;
      }

      try {
        const response = await api.get('/billings');
        const nextBilling =
          (response.data.data || []).find((billing) => billing.appointment?._id === existingAppointment._id) || null;
        setLinkedBilling(nextBilling);
      } catch (_error) {
        setLinkedBilling(null);
      }
    };

    loadLinkedBilling();
  }, [existingAppointment?._id]);

  useEffect(() => {
    if (!isPatientNewBooking) {
      return;
    }

    if (skipNextPatientAvailabilityReset) {
      setSkipNextPatientAvailabilityReset(false);
      return;
    }

    setAvailableDoctors([]);
    setHasSearchedDoctors(false);
    setShowDoctorResults(true);
    setBookingPreview(null);
    setForm((current) => ({
      ...current,
      doctor: '',
    }));
  }, [form.appointmentDate, form.appointmentSession, isPatientNewBooking, skipNextPatientAvailabilityReset]);

  useEffect(() => {
    const loadBookingPreview = async () => {
      if (!isPatientNewBooking || !form.doctor || !form.appointmentDate || !form.appointmentSession) {
        setBookingPreview(null);
        return;
      }

      try {
        const response = await api.get('/appointments/booking-preview', {
          params: {
            doctor: form.doctor,
            date: form.appointmentDate,
            session: form.appointmentSession,
          },
        });

        setBookingPreview(response.data.data);
      } catch (_error) {
        setBookingPreview(null);
      }
    };

    loadBookingPreview();
  }, [form.appointmentDate, form.appointmentSession, form.doctor, isPatientNewBooking]);

  const sessionPickerItems = sessionOptions
    .filter((item) => item.isAvailable || item.value === form.appointmentSession)
    .map((item) => ({
      label: `${item.label} (${item.timeRange})${item.isAvailable ? '' : ' - unavailable'}`,
      value: item.value,
    }));

  const handleDoctorSearch = async () => {
    if (!form.appointmentDate || !form.appointmentSession) {
      Alert.alert('Missing filters', 'Please choose the appointment date and clinic session first.');
      return;
    }

    try {
      setSearchingDoctors(true);
      const response = await api.get('/appointments/available-doctors', {
        params: {
          date: form.appointmentDate,
          session: form.appointmentSession,
          search: doctorSearch.trim() || undefined,
          specialization: specializationFilter || undefined,
        },
      });

      const nextDoctors = response.data.data || [];
      setAvailableDoctors(nextDoctors);
      setHasSearchedDoctors(true);
      setShowDoctorResults(true);

      if (!nextDoctors.some((doctor) => doctor._id === form.doctor)) {
        setForm((current) => ({ ...current, doctor: '' }));
        setBookingPreview(null);
      }
    } catch (error) {
      Alert.alert('Search failed', error?.response?.data?.message || 'Unable to search doctors right now.');
    } finally {
      setSearchingDoctors(false);
    }
  };

  const handleDoctorSelect = (doctor) => {
    setForm((current) => ({
      ...current,
      doctor: doctor._id,
    }));
    setDoctorSearch(`${doctor.firstName} ${doctor.lastName}`);
    setSpecializationFilter(doctor.specialization || '');
    setBookingPreview({
      doctor,
      dateKey: form.appointmentDate,
      session: form.appointmentSession,
      nextTokenNumber: doctor.nextTokenNumber,
    });
    setShowDoctorResults(false);
  };

  const handleSubmit = async () => {
    const selectedDoctor = resolveSelectedDoctor();
    const scheduledAppointmentDate = buildAppointmentDateForSession(form.appointmentDate, form.appointmentSession);
    const missingFields = [];

    if (!selectedDoctor?._id) {
      missingFields.push('doctor');
    }

    if (!form.appointmentDate) {
      missingFields.push('appointment date');
    }

    if (!form.appointmentSession) {
      missingFields.push('clinic session');
    }

    if (missingFields.length > 0) {
      const missingLabel =
        missingFields.length === 1
          ? missingFields[0]
          : `${missingFields.slice(0, -1).join(', ')} and ${missingFields[missingFields.length - 1]}`;

      Alert.alert('Missing fields', `Please complete the ${missingLabel}.`);
      return;
    }

    if (user?.role !== 'patient' && !isGuestBooking && !form.patient) {
      Alert.alert('Missing patient', 'Please select a patient for this appointment.');
      return;
    }

    if (isPatientEditingAppointment && !patientAppointmentEditState.canEdit) {
      Alert.alert('Update unavailable', patientAppointmentEditState.reason);
      return;
    }

    if (isGuestBooking) {
      const bookingDraft = {
        form: {
          ...form,
          doctor: selectedDoctor._id,
          patient: '',
          paymentMethod: form.paymentMethod || 'paypal',
        },
        doctorSearch,
        specializationFilter,
        availableDoctors,
        bookingPreview,
        hasSearchedDoctors,
        showDoctorResults,
      };

      await startAppointmentBookingAuthFlow(bookingDraft);

      Alert.alert(
        'Login required',
        'Please log in or create a patient account to confirm this appointment. Your booking details have been saved temporarily.',
        [
          {
            text: 'Login',
            onPress: () => navigation.navigate('Login'),
          },
          {
            text: 'Register',
            onPress: () => navigation.navigate('Register', { registrationType: 'patient' }),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = isPatientEditingAppointment
        ? {
            appointmentDate: scheduledAppointmentDate,
            appointmentSession: form.appointmentSession,
          }
        : {
            doctor: selectedDoctor._id,
            appointmentDate: scheduledAppointmentDate,
            appointmentSession: form.appointmentSession,
            paymentMethod: form.paymentMethod || 'paypal',
            reason: 'Clinic appointment',
          };

      if (!isPatientNewBooking && !isPatientEditingAppointment && form.patient) {
        payload.patient = form.patient;
      }

      const response = existingAppointment?._id
        ? await api.put(`/appointments/${existingAppointment._id}`, payload)
        : await api.post('/appointments', payload);

      const savedAppointment = response?.data?.data;
      const paymentSummary = savedAppointment?.paymentSummary;
      const successMessage =
        isPatientEditingAppointment
          ? 'Appointment updated successfully.'
          : isPatientNewBooking && savedAppointment?.tokenNumber
          ? `Appointment booked successfully. Your token number is ${savedAppointment.tokenNumber}. Fee: ${formatCurrency(paymentSummary?.amount || selectedDoctorFee.amount, paymentSummary?.currency || selectedDoctorFee.currency)}.`
          : 'Appointment saved successfully.';

      Alert.alert('Saved', successMessage);
      await clearPendingAppointmentBooking();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!existingAppointment?._id) {
      return;
    }

    if (!cancellationState?.canCancel) {
      Alert.alert('Cancellation unavailable', cancellationState?.reason || 'This appointment cannot be cancelled.');
      return;
    }

    Alert.alert(
      'Cancel appointment',
      'Are you sure you want to cancel this appointment? This action cannot be undone.',
      [
        { text: 'Keep appointment', style: 'cancel' },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(`/appointments/${existingAppointment._id}`, { status: 'cancelled' });
              Alert.alert('Cancelled', 'Your appointment has been cancelled successfully.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Cancellation failed', error?.response?.data?.message || 'Unable to cancel appointment.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert('Delete appointment', 'Are you sure you want to delete this appointment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/appointments/${existingAppointment._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete appointment.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingOverlay message="Preparing appointment form..." />;
  }

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Appointment details</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {isPatientNewBooking
            ? 'Search by doctor name or specialization, then pick an available doctor and confirm your token.'
            : isPatientEditingAppointment
              ? 'Patients can only update the date or session before payment and at least 6 hours before the appointment.'
              : isAdminViewer
                ? 'Review the booked appointment details. Admins can view appointments here but cannot change them.'
            : 'Review or adjust the visit date, doctor, and clinic session.'}
        </Text>

        {existingAppointment ? (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDark ? themeColors.surfaceMuted : '#F0FDFA',
                borderColor: isDark ? themeColors.border : '#BFECE8',
              },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: themeColors.primaryDark }]}>Appointment summary</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>
              Patient: {existingAppointment.patient?.firstName} {existingAppointment.patient?.lastName}
            </Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>
              Doctor: Dr {existingAppointment.doctor?.firstName} {existingAppointment.doctor?.lastName}
            </Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>
              Token: {existingAppointment.tokenNumber || '-'}
            </Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>
              Payment: {linkedBilling?.status || 'pending'}
            </Text>
            {isPatientEditingAppointment && !patientAppointmentEditState.canEdit ? (
              <Text style={[styles.paymentWarning, { color: themeColors.danger }]}>
                {patientAppointmentEditState.reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isGuestBooking ? (
          <View
            style={[
              styles.guestNotice,
              {
                backgroundColor: isDark ? themeColors.surfaceMuted : '#F0FDFA',
                borderColor: isDark ? themeColors.border : '#BFECE8',
              },
            ]}
          >
            <Text style={[styles.guestNoticeTitle, { color: themeColors.primaryDark }]}>
              You can start booking now.
            </Text>
            <Text style={[styles.guestNoticeText, { color: themeColors.textMuted }]}>
              You will be asked to log in or register only when you confirm the appointment, and your booking details will continue from there.
            </Text>
          </View>
        ) : null}

        {!isAdminViewer && user?.role && user.role !== 'patient' ? (
          <AppSelect
            items={toPickerItems(patients, (patient) => `${patient.firstName} ${patient.lastName}`)}
            label="Patient"
            onValueChange={(patient) => setForm((current) => ({ ...current, patient }))}
            value={form.patient}
          />
        ) : null}

        <DateTimeField
          disabled={isAdminViewer || (isPatientEditingAppointment && !patientAppointmentEditState.canEdit)}
          label="Appointment date"
          minimumDate={user?.role === 'patient' || isGuestBooking ? new Date(`${getTodayDateKey()}T00:00:00`) : undefined}
          mode="date"
          onChange={(appointmentDate) => setForm((current) => ({ ...current, appointmentDate }))}
          value={form.appointmentDate}
        />

        {isPatientNewBooking ? (
          <>
            <AppSelect
              items={getClinicSessionsForDate(form.appointmentDate).map((session) => ({
                label: `${session.label} (${session.timeRange})`,
                value: session.value,
              }))}
              label="Clinic session"
              onValueChange={(appointmentSession) => setForm((current) => ({ ...current, appointmentSession }))}
              value={form.appointmentSession}
            />
            <AppInput
              label="Doctor name"
              onChangeText={setDoctorSearch}
              placeholder="Type a doctor's name"
              value={doctorSearch}
            />
            {doctorSuggestions.length > 0 ? (
              <View style={[styles.suggestionList, { borderColor: themeColors.border }]}>
                {doctorSuggestions.map((doctor) => (
                  <Pressable
                    key={doctor._id}
                    onPress={() => {
                      setDoctorSearch(`${doctor.firstName} ${doctor.lastName}`);
                      setSpecializationFilter(doctor.specialization || '');
                    }}
                    style={[
                      styles.suggestionItem,
                      {
                        backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC',
                        borderBottomColor: themeColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.suggestionName, { color: themeColors.text }]}>
                      Dr {doctor.firstName} {doctor.lastName}
                    </Text>
                    <Text style={[styles.suggestionMeta, { color: themeColors.textMuted }]}>
                      {doctor.specialization || 'Doctor'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <AppSelect
              items={specializationOptions}
              label="Specialization"
              onValueChange={setSpecializationFilter}
              value={specializationFilter}
            />
            <AppButton loading={searchingDoctors} onPress={handleDoctorSearch} title="Search doctors" />

            {showDoctorResults ? (
              <View style={styles.resultsBlock}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Available doctors</Text>
                {!hasSearchedDoctors ? (
                  <Text style={[styles.searchHint, { color: themeColors.textMuted }]}>
                    Choose the date and session, then search to see doctors available for that session.
                  </Text>
                ) : availableDoctors.length === 0 ? (
                  <Text style={[styles.searchHint, { color: themeColors.textMuted }]}>
                    No available doctors matched your search for that date and session.
                  </Text>
                ) : (
                  availableDoctors.map((doctor) => {
                    const isSelected = form.doctor === doctor._id;

                    return (
                      <Pressable
                        key={doctor._id}
                        onPress={() => handleDoctorSelect(doctor)}
                        style={[
                          styles.doctorCard,
                          {
                            backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC',
                            borderColor: themeColors.border,
                          },
                          isSelected && {
                            backgroundColor: isDark ? '#123C47' : '#ECFEFF',
                            borderColor: themeColors.primary,
                          },
                        ]}
                      >
                        <Text style={[styles.doctorName, { color: themeColors.text }]}>
                          Dr {doctor.firstName} {doctor.lastName}
                        </Text>
                        <Text style={[styles.doctorMeta, { color: themeColors.textMuted }]}>
                          {doctor.specialization || 'Doctor'}
                        </Text>
                        <Text style={[styles.doctorMeta, { color: themeColors.textMuted }]}>
                          Fee: {formatCurrency(
                            doctor.appointmentFee?.amount || appointmentFee.amount,
                            doctor.appointmentFee?.currency || appointmentFee.currency
                          )}
                        </Text>
                        <View style={[styles.tokenBlock, { borderTopColor: themeColors.border }]}>
                          <Text style={[styles.tokenLabel, { color: themeColors.textMuted }]}>Next token</Text>
                          <Text style={[styles.tokenNumber, { color: themeColors.primaryDark }]}>
                            {doctor.nextTokenNumber}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {bookingPreview?.nextTokenNumber ? (
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: isDark ? themeColors.surfaceMuted : '#F0FDFA',
                    borderColor: isDark ? themeColors.border : '#BFECE8',
                  },
                ]}
              >
                <Text style={[styles.previewLabel, { color: themeColors.primaryDark }]}>Booking preview</Text>
                <Text style={[styles.previewText, { color: themeColors.text }]}>
                  Doctor: Dr {bookingPreview.doctor.firstName} {bookingPreview.doctor.lastName}
                </Text>
                <View style={[styles.previewTokenBlock, { borderTopColor: themeColors.border }]}>
                  <Text style={[styles.previewTokenLabel, { color: themeColors.primaryDark }]}>
                    Next available token
                  </Text>
                  <Text style={[styles.previewTokenNumber, { color: themeColors.primaryDark }]}>
                    {bookingPreview.nextTokenNumber}
                  </Text>
                </View>
                <Text style={[styles.paymentWarning, { color: themeColors.danger }]}>
                  Payment must be completed before the doctor can start the appointment.
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.feeCard,
                {
                  backgroundColor: isDark ? '#2E2415' : '#FFF7ED',
                  borderColor: isDark ? '#7C4A16' : '#FED7AA',
                },
              ]}
            >
              <Text style={[styles.feeLabel, { color: themeColors.textMuted }]}>Appointment fee</Text>
              <Text style={[styles.feeAmount, { color: themeColors.primaryDark }]}>
                {formatCurrency(selectedDoctorFee.amount, selectedDoctorFee.currency)}
              </Text>
              <Text style={[styles.feeHint, { color: themeColors.textMuted }]}>
                {form.doctor
                  ? 'This is the fee for the currently selected doctor. Choose PayPal for online payment, or cash/card if you plan to pay at the clinic counter.'
                  : 'This is the clinic default fee until you select a doctor. Choose PayPal for online payment, or cash/card if you plan to pay at the clinic counter.'}
              </Text>
            </View>
            <AppSelect
              items={paymentMethods.map((method) => ({
                label:
                  method === 'paypal'
                    ? 'PayPal online'
                    : method === 'cash'
                      ? 'Cash at clinic'
                      : 'Card at clinic',
                value: method,
              }))}
              label="Payment method"
              onValueChange={(paymentMethod) => setForm((current) => ({ ...current, paymentMethod }))}
              value={form.paymentMethod}
            />
          </>
        ) : isPatientEditingAppointment ? (
          <>
            <AppSelect
              enabled={patientAppointmentEditState.canEdit}
              items={sessionPickerItems}
              label="Clinic session"
              onValueChange={(appointmentSession) => setForm((current) => ({ ...current, appointmentSession }))}
              value={form.appointmentSession}
            />
            {form.doctor && form.appointmentDate && sessionPickerItems.length === 0 ? (
              <Text style={[styles.helperText, { color: themeColors.danger }]}>
                No clinic sessions are currently available for that doctor on the selected date.
              </Text>
            ) : null}
            <View
              style={[
                styles.readonlyCard,
                { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.readonlyTitle, { color: themeColors.text }]}>Doctor</Text>
              <Text style={[styles.readonlyValue, { color: themeColors.text }]}>
                Dr {existingAppointment.doctor?.firstName} {existingAppointment.doctor?.lastName}
              </Text>
              <Text style={[styles.readonlyMeta, { color: themeColors.textMuted }]}>
                {existingAppointment.doctor?.specialization || 'Doctor'}
              </Text>
              <Text style={[styles.readonlyMeta, { color: themeColors.textMuted }]}>
                Payment status: {linkedBilling?.status || 'pending'}
              </Text>
            </View>
          </>
        ) : isAdminViewer ? (
          <View
            style={[
              styles.readonlyCard,
              { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.readonlyTitle, { color: themeColors.text }]}>Booked appointment</Text>
            <Text style={[styles.readonlyValue, { color: themeColors.text }]}>
              Dr {existingAppointment?.doctor?.firstName} {existingAppointment?.doctor?.lastName}
            </Text>
            <Text style={[styles.readonlyMeta, { color: themeColors.textMuted }]}>
              Session: {existingAppointment?.appointmentSession || 'Not set'}
            </Text>
            <Text style={[styles.readonlyMeta, { color: themeColors.textMuted }]}>
              Status: {existingAppointment?.status || 'scheduled'}
            </Text>
          </View>
        ) : (
          <>
            <AppInput
              label="Search doctor by name"
              onChangeText={setAdminDoctorSearch}
              placeholder="Type a doctor's name"
              value={adminDoctorSearch}
            />
            <AppSelect
              items={toPickerItems(filteredDoctors, (doctor) =>
                `${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`
              )}
              label="Doctor"
              onValueChange={(doctorId) => {
                const selectedDoctor = doctors.find((item) => item._id === doctorId);
                setForm((current) => ({ ...current, doctor: doctorId }));
                if (selectedDoctor) {
                  setAdminDoctorSearch(`${selectedDoctor.firstName} ${selectedDoctor.lastName}`);
                }
              }}
              value={form.doctor}
            />
            {adminDoctorSearch.trim() && filteredDoctors.length === 0 ? (
              <Text style={[styles.helperText, { color: themeColors.danger }]}>
                No doctors matched that name.
              </Text>
            ) : null}
            <AppSelect
              items={sessionPickerItems}
              label="Clinic session"
              onValueChange={(appointmentSession) => setForm((current) => ({ ...current, appointmentSession }))}
              value={form.appointmentSession}
            />
            {form.doctor && form.appointmentDate && sessionPickerItems.length === 0 ? (
              <Text style={[styles.helperText, { color: themeColors.danger }]}>
                No clinic sessions are currently available for that doctor on the selected date.
              </Text>
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          {!isAdminViewer ? (
            <AppButton
              disabled={submitting || (isPatientEditingAppointment && !patientAppointmentEditState.canEdit)}
              loading={submitting}
              onPress={handleSubmit}
              title={
                isGuestBooking
                  ? 'Continue to confirm'
                  : isPatientNewBooking
                    ? 'Confirm booking'
                    : isPatientEditingAppointment
                      ? 'Update appointment'
                      : 'Save appointment'
              }
            />
          ) : null}
          {user?.role === 'patient' && existingAppointment ? (
            <AppButton
              disabled={!cancellationState?.canCancel}
              onPress={handleCancelAppointment}
              title={cancellationState?.canCancel ? 'Cancel appointment' : 'Cancellation unavailable'}
              variant={cancellationState?.canCancel ? 'danger' : 'secondary'}
            />
          ) : null}
          {existingAppointment && user?.role && !['patient', 'admin'].includes(user.role) ? (
            <AppButton onPress={handleDelete} title="Delete" variant="danger" />
          ) : null}
          {user?.role === 'patient' && existingAppointment && !cancellationState?.canCancel ? (
            <Text style={[styles.helperText, { color: themeColors.textMuted }]}>
              {cancellationState?.reason}
            </Text>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#BFECE8',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  summaryText: {
    color: colors.text,
    lineHeight: 20,
  },
  guestNotice: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#BFECE8',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  guestNoticeTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  guestNoticeText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  helperText: {
    color: colors.danger,
    marginTop: -4,
    marginBottom: spacing.md,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginTop: -4,
    marginBottom: spacing.md,
  },
  suggestionItem: {
    backgroundColor: '#F8FBFC',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionName: {
    color: colors.text,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: colors.textMuted,
    marginTop: 2,
  },
  resultsBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  searchHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  doctorCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  doctorCardSelected: {
    backgroundColor: '#ECFEFF',
    borderColor: colors.primary,
  },
  doctorName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  doctorMeta: {
    color: colors.textMuted,
    marginTop: 4,
  },
  tokenBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#CFEAEC',
  },
  tokenLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tokenNumber: {
    color: colors.primaryDark,
    fontWeight: '900',
    fontSize: 34,
    lineHeight: 40,
    marginTop: 2,
  },
  previewTokenBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#BFECE8',
  },
  previewCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#BFECE8',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewLabel: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  previewText: {
    color: colors.text,
    lineHeight: 20,
  },
  paymentWarning: {
    color: colors.danger,
    lineHeight: 20,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  feeCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  feeLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  feeAmount: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  feeHint: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  previewTokenLabel: {
    color: colors.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  previewTokenNumber: {
    color: colors.primaryDark,
    fontWeight: '900',
    fontSize: 42,
    lineHeight: 48,
    marginTop: 2,
  },
  readonlyCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  readonlyTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  readonlyValue: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 21,
  },
  readonlyMeta: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
  },
});
