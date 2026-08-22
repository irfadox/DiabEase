import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '../utils/supabase';
import { User, Mail, Lock, Briefcase, FileText, ChevronRight } from 'lucide-react-native';
import { useSettings } from '../context/SettingsContext';
import { useLanguageContext, AVAILABLE_LANGUAGES } from '../context/LanguageContext';
import LangAuthScreen from '../lang/LangAuthScreen';
import LangCommon from '../lang/LangCommon';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function AuthScreen() {
  const { getAdjustedFontSize } = useSettings();
  const { language, setLanguage } = useLanguageContext();
  const t = LangAuthScreen[language];
  const common = LangCommon[language];

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('patient');
  const [affiliation, setAffiliation] = useState('');
  const [description, setDescription] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert(common.error, t.errorFillFields);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        if (!fullName || !phoneNumber) {
          Alert.alert(common.error, t.errorFillNamePhone);
          setLoading(false);
          return;
        }

        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone_number: phoneNumber,
              role: role,
              affiliation: affiliation,
              description: description,
            },
          },
        });
        
        if (error) throw error;

        if (authData?.user) {
           await supabase.from('profiles').upsert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                phone_number: phoneNumber,
                role: role,
                affiliation: affiliation,
                description: description,
           }]);
        }

        Alert.alert(common.success, t.successAccountCreated);
      }
    } catch (error) {
      Alert.alert(t.errorAuth, error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/icon.png')} style={styles.logoImage} />
          </View>
          <Text style={[styles.title, { fontSize: getAdjustedFontSize(28) }]}>{isLogin ? t.welcomeBack : t.createAccount}</Text>
          <Text style={[styles.subtitle, { fontSize: getAdjustedFontSize(16) }]}>
            {isLogin ? t.loginSubtitle : t.signupSubtitle}
          </Text>
        </View>

        <View style={styles.languageSection}>
          <Text style={[styles.languageLabel, { fontSize: getAdjustedFontSize(14) }]}>{t.languageTitle}</Text>
          <LanguageSwitcher
            languages={AVAILABLE_LANGUAGES}
            language={language}
            onChange={setLanguage}
            fontSize={getAdjustedFontSize(13)}
          />
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Mail size={20} color="#00BFA5" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
              placeholder={t.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color="#00BFA5" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
              placeholder={t.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {!isLogin && (
            <>
              <View style={styles.inputWrapper}>
                <User size={20} color="#00BFA5" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
                  placeholder={t.fullNamePlaceholder}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Briefcase size={20} color="#00BFA5" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
                  placeholder={t.phonePlaceholder}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.roleContainer}>
                <Text style={[styles.label, { fontSize: getAdjustedFontSize(14) }]}>{t.registerAs}</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[styles.roleButton, role === 'patient' && styles.roleButtonActive]}
                    onPress={() => setRole('patient')}
                  >
                    <Text style={[styles.roleButtonText, role === 'patient' && styles.roleButtonTextActive, { fontSize: getAdjustedFontSize(14) }]}>{t.patient}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleButton, role === 'doctor' && styles.roleButtonActive]}
                    onPress={() => setRole('doctor')}
                  >
                    <Text style={[styles.roleButtonText, role === 'doctor' && styles.roleButtonTextActive, { fontSize: getAdjustedFontSize(14) }]}>{t.doctor}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {role === 'doctor' && (
                <View style={styles.inputWrapper}>
                  <Briefcase size={20} color="#00BFA5" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { fontSize: getAdjustedFontSize(16) }]}
                    placeholder={t.affiliationPlaceholder}
                    value={affiliation}
                    onChangeText={setAffiliation}
                  />
                </View>
              )}

              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <FileText size={20} color="#00BFA5" style={[styles.inputIcon, { marginTop: 12 }]} />
                <TextInput
                  style={[styles.input, styles.textArea, { fontSize: getAdjustedFontSize(16) }]}
                  placeholder={role === 'doctor' ? t.doctorDescPlaceholder : t.patientDescPlaceholder}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.authButton}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={[styles.authButtonText, { fontSize: getAdjustedFontSize(18) }]}>{isLogin ? t.login : t.signup}</Text>
                <ChevronRight size={20} color="white" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={[styles.switchText, { fontSize: getAdjustedFontSize(14) }]}>
              {isLogin ? t.noAccount : t.hasAccount}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#00BFA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'BOLD',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  languageSection: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  languageLabel: {
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#E1E5EB',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textAreaWrapper: {
    height: 100,
    alignItems: 'flex-start',
  },
  textArea: {
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  roleContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginLeft: 4,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#00BFA5',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  roleButtonActive: {
    backgroundColor: '#00BFA5',
  },
  roleButtonText: {
    color: '#00BFA5',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  authButton: {
    backgroundColor: '#00BFA5',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  authButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#00BFA5',
    fontSize: 14,
    fontWeight: '500',
  },
});
