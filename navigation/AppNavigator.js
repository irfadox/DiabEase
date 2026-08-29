import React, { useState, useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator } from 'react-native';
import { Book, Bell, MessageSquare, Users, Settings as SettingsIcon } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { useLanguageContext } from '../context/LanguageContext';
import LangAppNavigator from '../lang/LangAppNavigator';
import LangAboutProjectScreen from '../lang/LangAboutProjectScreen';
import LangCommon from '../lang/LangCommon';

import DiaryScreen from '../screens/DiaryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ChatScreen from '../screens/ChatScreen';
import AuthScreen from '../screens/AuthScreen';
import PatientListScreen from '../screens/PatientListScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import AboutProjectScreen from '../screens/AboutProjectScreen';
import LangPatientDetailScreen from '../lang/LangPatientDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { language } = useLanguageContext();
  const t = LangAppNavigator[language];
  const common = LangCommon[language];

  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const authInitializedRef = useRef(false);
  const lastErrorTime = useRef(0);

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('AppNavigator: Initializing session...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        console.log('AppNavigator: Session found:', session ? 'Yes' : 'No');
        setSession(session);
        if (session) await fetchProfile(session.user.id);
        else setLoading(false);
      } catch (err) {
        console.error('AppNavigator: Auth initialization failed:', err.message);

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn('AppNavigator: Could not clear invalid session:', signOutError.message);
        }
        setSession(null);
        setRole(null);
      } finally {
        authInitializedRef.current = true;
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('AppNavigator: Safety timeout reached. Forcing render.');
        setLoading(false);
      }
    }, 10000);

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!authInitializedRef.current) {
        return;
      }

      clearTimeout(safetyTimeout);
      console.log('AppNavigator: Event:', _event);
      setSession(session);
      if (session) await fetchProfile(session.user.id);
      else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    console.log('AppNavigator: Fetching profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.warn('AppNavigator: Profile find error:', error.message);
      }
      
      if (!data && !error) {
        console.warn('AppNavigator: Profile missing for user. Attempting fallback creation.');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const roleFallback = user.user_metadata?.role || 'patient';
            await supabase.from('profiles').insert([{
                id: userId,
                email: user.email,
                full_name: user.user_metadata?.full_name || common.unknown,
                role: roleFallback,
                phone_number: user.user_metadata?.phone_number || null,
                affiliation: user.user_metadata?.affiliation || null,
                description: user.user_metadata?.description || null,
            }]);
            setRole(roleFallback);
        }
      } else if (data) {
        console.log('AppNavigator: Profile role:', data.role);
        setRole(data.role);
      }
    } catch (e) {
      console.error('AppNavigator: Profile fetch exception:', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#00BFA5" />
        <Text style={{ marginTop: 12, color: '#666' }}>{t.connecting}</Text>
      </View>
    );
  }

  const aboutScreenOptions = {
    title: LangAboutProjectScreen[language].screenTitle,
    headerStyle: { backgroundColor: '#f8f9fa' },
    headerTitleStyle: { fontWeight: '600' },
    headerTintColor: '#00BFA5',
  };

  const DoctorTabs = () => (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#00BFA5',
        tabBarInactiveTintColor: 'gray',
        headerStyle: { backgroundColor: '#f8f9fa' },
      }}
    >
      <Tab.Screen
        name="Patients"
        component={PatientListScreen}
        options={{
          title: t.myPatients,
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );

  const PatientTabs = () => (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Diary') return <Book size={size} color={color} />;
          if (route.name === 'Reminders') return <Bell size={size} color={color} />;
          if (route.name === 'Chat') return <MessageSquare size={size} color={color} />;
          if (route.name === 'Settings') return <SettingsIcon size={size} color={color} />;
        },
        tabBarActiveTintColor: '#00BFA5',
        tabBarInactiveTintColor: 'gray',
        headerStyle: { backgroundColor: '#f8f9fa' },
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Diary" component={DiaryScreen} options={{ title: t.diary }} />
      <Tab.Screen name="Reminders" component={RemindersScreen} options={{ title: t.reminders }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: t.chat }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.settings }} />
    </Tab.Navigator>
  );

  return (
    <NavigationContainer>
      {session ? (
        <Stack.Navigator>
          <Stack.Screen
            name="Main"
            component={role === 'doctor' ? DoctorTabs : PatientTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AboutProject"
            component={AboutProjectScreen}
            options={aboutScreenOptions}
          />
          <Stack.Screen
            name="PatientDetail"
            component={PatientDetailScreen}
            options={({ route }) => ({
              title: route.params?.patientName || LangPatientDetailScreen[language].screenTitle,
              headerStyle: { backgroundColor: '#f8f9fa' },
              headerTitleStyle: { fontWeight: '600' },
              headerTintColor: '#00BFA5',
            })}
          />
          <Stack.Screen
            name="PatientChat"
            component={ChatScreen}
            options={({ route }) => ({
              title: route.params?.patientName || t.chat,
              headerStyle: { backgroundColor: '#f8f9fa' },
              headerTitleStyle: { fontWeight: '600' },
              headerTintColor: '#00BFA5',
            })}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AboutProject"
            component={AboutProjectScreen}
            options={aboutScreenOptions}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
