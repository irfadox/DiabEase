import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../utils/supabase';
import { showAlert } from '../utils/alert';

export default function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Общие поля
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('doctor'); // по умолчанию для тестов ставим врача

  // Дополнительные поля регистрации
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [description, setDescription] = useState('');

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) throw error;
      } else {
        if (!fullName.trim()) {
          showAlert('Ошибка', 'Укажите ваше имя');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              role: role,
              affiliation: affiliation.trim(),
              description: description.trim(),
            },
          },
        });

        if (error) throw error;

        showAlert('Успешно', 'Регистрация прошла успешно!');
      }
    } catch (err) {
      console.error('Auth error:', err);
      showAlert('Ошибка авторизации', err.message || 'Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Вход в DiabEase' : 'Создайте аккаунт'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Войдите для доступа к данным' : 'Начните заботу о здоровье прямо сейчас'}
          </Text>

          {/* Переключатель роли при регистрации */}
          {!isLogin && (
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]}
                onPress={() => setRole('patient')}
              >
                <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>
                  Пациент
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]}
                onPress={() => setRole('doctor')}
              >
                <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>
                  Врач
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="ФИО / Имя"
              placeholderTextColor="#888"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Номер телефона"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          )}

          {!isLogin && role === 'doctor' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Клиника / Организация"
                placeholderTextColor="#888"
                value={affiliation}
                onChangeText={setAffiliation}
              />
              <TextInput
                style={styles.input}
                placeholder="Специализация / Должность"
                placeholderTextColor="#888"
                value={description}
                onChangeText={setDescription}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isLogin ? 'Войти' : 'Зарегистрироваться'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchText}>
              {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войдите'}
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
    backgroundColor: '#121716',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1c2423',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2b3836',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00cc96',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ba3a1',
    textAlign: 'center',
    marginBottom: 20,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: '#121716',
    padding: 4,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleBtnActive: {
    backgroundColor: '#00cc96',
  },
  roleText: {
    color: '#9ba3a1',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#121716',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#121716',
    borderWidth: 1,
    borderColor: '#2b3836',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#00cc96',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: {
    color: '#121716',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#00cc96',
    fontSize: 14,
  },
});
