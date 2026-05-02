import { useEffect } from 'react';
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import SplashScreen from '../screens/SplashScreen';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AppointmentListScreen from '../screens/AppointmentListScreen';
import AppointmentFormScreen from '../screens/AppointmentFormScreen';
import BillingListScreen from '../screens/BillingListScreen';
import BillingDetailScreen from '../screens/BillingDetailScreen';
import MedicalRecordListScreen from '../screens/MedicalRecordListScreen';
import MedicalRecordFormScreen from '../screens/MedicalRecordFormScreen';
import MedicalHistoryScreen from '../screens/MedicalHistoryScreen';
import PatientMedicalRecordScreen from '../screens/PatientMedicalRecordScreen';
import PrescriptionListScreen from '../screens/PrescriptionListScreen';
import PrescriptionFormScreen from '../screens/PrescriptionFormScreen';
import AlertListScreen from '../screens/AlertListScreen';
import AlertFormScreen from '../screens/AlertFormScreen';
import ReviewListScreen from '../screens/ReviewListScreen';
import ReviewFormScreen from '../screens/ReviewFormScreen';
import NotificationListScreen from '../screens/NotificationListScreen';
import DrugInventoryListScreen from '../screens/DrugInventoryListScreen';
import DrugFormScreen from '../screens/DrugFormScreen';
import UserManagementScreen from '../screens/UserManagementScreen';
import UserFormScreen from '../screens/UserFormScreen';
import ClinicScheduleScreen from '../screens/ClinicScheduleScreen';
import { spacing, useTheme } from '../theme';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const AppointmentStack = createNativeStackNavigator();
const RecordStack = createNativeStackNavigator();
const AlertStack = createNativeStackNavigator();
const BillingStack = createNativeStackNavigator();
const DrugStack = createNativeStackNavigator();
const PrescriptionStack = createNativeStackNavigator();
const UsersStack = createNativeStackNavigator();

const getSharedScreenOptions = (colors) => ({
  headerStyle: { backgroundColor: colors.primaryDark },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: '700' },
});

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="AppointmentForm" component={AppointmentFormScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const homeComponent = user?.role === 'admin' ? AdminDashboardScreen : DashboardScreen;
  const homeTitle = user?.role === 'admin' ? 'Admin Dashboard' : 'Dashboard';

  return (
    <HomeStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <HomeStack.Screen name="Dashboard" component={homeComponent} options={{ title: homeTitle }} />
      <HomeStack.Screen name="BillingList" component={BillingListScreen} options={{ title: 'Billing' }} />
      <HomeStack.Screen name="BillingDetail" component={BillingDetailScreen} options={{ title: 'Billing Details' }} />
      <HomeStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <HomeStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
      <HomeStack.Screen name="PrescriptionList" component={PrescriptionListScreen} options={{ title: 'Prescriptions' }} />
      <HomeStack.Screen name="PrescriptionForm" component={PrescriptionFormScreen} options={{ title: 'Prescription Form' }} />
      <HomeStack.Screen name="ReviewList" component={ReviewListScreen} options={{ title: 'Feedback' }} />
      <HomeStack.Screen name="ReviewForm" component={ReviewFormScreen} options={{ title: 'Feedback' }} />
      <HomeStack.Screen name="NotificationList" component={NotificationListScreen} options={{ title: 'Notifications' }} />
      <HomeStack.Screen name="DrugInventoryList" component={DrugInventoryListScreen} options={{ title: 'Drug Inventory' }} />
      <HomeStack.Screen name="DrugForm" component={DrugFormScreen} options={{ title: 'Drug Form' }} />
      <HomeStack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'Users' }} />
      <HomeStack.Screen name="UserForm" component={UserFormScreen} options={{ title: 'User Details' }} />
      <HomeStack.Screen name="ClinicSchedule" component={ClinicScheduleScreen} options={{ title: 'Clinic Hours' }} />
    </HomeStack.Navigator>
  );
}

function AppointmentNavigator() {
  const { colors } = useTheme();

  return (
    <AppointmentStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <AppointmentStack.Screen name="AppointmentList" component={AppointmentListScreen} options={{ title: 'Appointments' }} />
      <AppointmentStack.Screen name="AppointmentForm" component={AppointmentFormScreen} options={{ title: 'Appointment Form' }} />
    </AppointmentStack.Navigator>
  );
}

function RecordNavigator() {
  const { colors } = useTheme();

  return (
    <RecordStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <RecordStack.Screen name="MedicalRecordList" component={MedicalRecordListScreen} options={{ title: 'Medical Records' }} />
      <RecordStack.Screen name="MedicalRecordForm" component={MedicalRecordFormScreen} options={{ title: 'Medical Record Form' }} />
      <RecordStack.Screen name="MedicalHistory" component={MedicalHistoryScreen} options={{ title: 'Medical History' }} />
      <RecordStack.Screen name="PatientMedicalRecord" component={PatientMedicalRecordScreen} options={{ title: 'Record Details' }} />
    </RecordStack.Navigator>
  );
}

function AlertsNavigator() {
  const { colors } = useTheme();

  return (
    <AlertStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <AlertStack.Screen name="AlertList" component={AlertListScreen} options={{ title: 'Alerts' }} />
      <AlertStack.Screen name="AlertForm" component={AlertFormScreen} options={{ title: 'Alert Form' }} />
    </AlertStack.Navigator>
  );
}

function BillingNavigator() {
  const { colors } = useTheme();

  return (
    <BillingStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <BillingStack.Screen name="BillingListTab" component={BillingListScreen} options={{ title: 'Billing' }} />
      <BillingStack.Screen name="BillingDetail" component={BillingDetailScreen} options={{ title: 'Billing Details' }} />
    </BillingStack.Navigator>
  );
}

function DrugNavigator() {
  const { colors } = useTheme();

  return (
    <DrugStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <DrugStack.Screen name="DrugInventoryListTab" component={DrugInventoryListScreen} options={{ title: 'Drug Inventory' }} />
      <DrugStack.Screen name="DrugForm" component={DrugFormScreen} options={{ title: 'Drug Form' }} />
    </DrugStack.Navigator>
  );
}

function PrescriptionNavigator() {
  const { colors } = useTheme();

  return (
    <PrescriptionStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <PrescriptionStack.Screen name="PrescriptionListTab" component={PrescriptionListScreen} options={{ title: 'Prescriptions' }} />
      <PrescriptionStack.Screen name="PrescriptionForm" component={PrescriptionFormScreen} options={{ title: 'Prescription Details' }} />
    </PrescriptionStack.Navigator>
  );
}

function UsersNavigator() {
  const { colors } = useTheme();

  return (
    <UsersStack.Navigator screenOptions={getSharedScreenOptions(colors)}>
      <UsersStack.Screen name="UserManagementList" component={UserManagementScreen} options={{ title: 'Users' }} />
      <UsersStack.Screen name="UserForm" component={UserFormScreen} options={{ title: 'User Details' }} />
    </UsersStack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const role = user?.role;
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarStyle: {
          height: 62 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          paddingHorizontal: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            HomeTab: 'home',
            AppointmentsTab: 'calendar',
            RecordsTab: 'document-text',
            AlertsTab: 'notifications',
            BillingTab: 'wallet',
            DrugTab: 'medkit',
            PrescriptionTab: 'document-text',
            UsersTab: 'people',
            ProfileTab: 'person',
          };

          return <Ionicons color={color} name={icons[route.name]} size={size} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} options={{ title: 'Home' }} />

      {['patient', 'doctor', 'admin'].includes(role) ? (
        <Tab.Screen name="AppointmentsTab" component={AppointmentNavigator} options={{ title: 'Appointments' }} />
      ) : null}

      {['patient', 'doctor', 'admin'].includes(role) ? (
        <Tab.Screen name="RecordsTab" component={RecordNavigator} options={{ title: 'Records' }} />
      ) : null}

      {['patient', 'doctor'].includes(role) ? (
        <Tab.Screen name="PrescriptionTab" component={PrescriptionNavigator} options={{ title: 'Prescriptions' }} />
      ) : null}

      {['patient', 'doctor', 'admin'].includes(role) ? (
        <Tab.Screen name="AlertsTab" component={AlertsNavigator} options={{ title: 'Alerts' }} />
      ) : null}

      {['patient', 'finance_manager', 'admin'].includes(role) ? (
        <Tab.Screen
          name="BillingTab"
          component={BillingNavigator}
          options={{ title: role === 'admin' ? 'Billing' : 'Payments' }}
        />
      ) : null}

      {role === 'pharmacist' ? (
        <Tab.Screen name="DrugTab" component={DrugNavigator} options={{ title: 'Inventory' }} />
      ) : null}

      {role === 'admin' ? (
        <Tab.Screen name="UsersTab" component={UsersNavigator} options={{ title: 'Users' }} />
      ) : null}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { loading, isAuthenticated, postAuthDestination, consumePostAuthDestination, user } = useAuth();
  const { colors } = useTheme();
  const navigationRef = useNavigationContainerRef();
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      primary: colors.primary,
      text: colors.text,
    },
  };

  useEffect(() => {
    if (!isAuthenticated || !user || !navigationRef.isReady()) {
      return;
    }

    if (postAuthDestination === 'resume-appointment-booking' && user.role === 'patient') {
      navigationRef.navigate('MainTabs', {
        screen: 'AppointmentsTab',
        params: {
          screen: 'AppointmentForm',
          params: {
            resumePendingBooking: true,
          },
        },
      });
      consumePostAuthDestination();
    }
  }, [consumePostAuthDestination, isAuthenticated, navigationRef, postAuthDestination, user]);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? <RootStack.Screen name="MainTabs" component={MainTabs} /> : <RootStack.Screen name="Auth" component={AuthNavigator} />}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
