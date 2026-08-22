import { decode, encode } from 'base-64';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (!global.btoa) { global.btoa = encode; }
if (!global.atob) { global.atob = decode; }

// Custom storage adapter for Supabase using AsyncStorage
const StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const realSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: StorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-application-name': 'deabease' },
  },
});

// ФЕЙКОВЫЕ АККАУНТЫ ДЛЯ ТЕСТИРОВАНИЯ ПРИЛОЖЕНИЯ
// здесь был айдар

let currentSession = null;
const listeners = [];
const channelListeners = [];

AsyncStorage.getItem('@mock_session').then(val => {
  if (val) {
    currentSession = JSON.parse(val);
    listeners.forEach(cb => cb('SIGNED_IN', currentSession));
  }
});

const isMockSession = () => {
  return currentSession && (currentSession.access_token === 'mock-access-token' || String(currentSession.user?.id).startsWith('mock-'));
};

const normalizeEmail = (email) => {
  if (!email) return '';
  const trimmed = email.trim().toLowerCase();
  if (trimmed === 'dev_test') return 'dev_test@example.com';
  if (trimmed === 'dev_test_doctor') return 'dev_test_doctor@example.com';
  return trimmed;
};

const getMockData = async (table) => {
  const key = `@mock_db_${table}`;
  const data = await AsyncStorage.getItem(key);
  if (data) return JSON.parse(data);

  let defaults = [];
  if (table === 'profiles') {
    defaults = [
      {
        id: "mock-patient-id",
        email: "dev_test@example.com",
        full_name: "dev_test",
        role: "patient",
        phone_number: "111",
        assigned_doctor_id: "mock-doctor-id",
        description: "Тестовый аккаунт пациента"
      },
      {
        id: "mock-doctor-id",
        email: "dev_test_doctor@example.com",
        full_name: "dev_test_doctor",
        role: "doctor",
        phone_number: "111",
        affiliation: "Клиника DiabEase",
        description: "Тестовый аккаунт врача"
      }
    ];
  } else if (table === 'logs') {
    defaults = [
      {
        id: 1,
        user_id: "mock-patient-id",
        sugar_level: 5.4,
        notes: "Завтрак: овсянка на воде с черникой и яйцо пашот",
        status: "Норма",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        user_id: "mock-patient-id",
        sugar_level: 8.2,
        notes: "Обед: картофельное пюре с котлетой и соком",
        status: "Высокий",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        user_id: "mock-patient-id",
        sugar_level: 6.1,
        notes: "Ужин вчера: запеченная рыба с брокколи",
        status: "Норма",
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ];
  } else if (table === 'reminders') {
    defaults = [
      {
        id: 1,
        user_id: "mock-patient-id",
        title: "Измерить сахар перед обедом",
        time: "13:00",
        type: "sugar",
        completed: false,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        user_id: "mock-patient-id",
        title: "Принять витамины",
        time: "09:00",
        type: "medication",
        completed: true,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  } else if (table === 'messages') {
    defaults = [
      {
        id: 1,
        sender_id: "mock-doctor-id",
        receiver_id: "mock-patient-id",
        text: "Здравствуйте, dev_test! Как ваши показатели сахара сегодня?",
        is_sos: false,
        is_system: false,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        sender_id: "mock-patient-id",
        receiver_id: "mock-doctor-id",
        text: "Здравствуйте! Утром было 5.4, после обеда немного повысился до 8.2, записал все в дневник.",
        is_sos: false,
        is_system: false,
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        sender_id: "mock-doctor-id",
        receiver_id: "mock-patient-id",
        text: "Отлично. Постарайтесь на обед уменьшить количество простых углеводов (пюре и сок). Продолжайте вести дневник.",
        is_sos: false,
        is_system: false,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
  await AsyncStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
};

const setMockData = async (table, data) => {
  const key = `@mock_db_${table}`;
  await AsyncStorage.setItem(key, JSON.stringify(data));
};

const publishInsert = (table, newRecord) => {
  channelListeners.forEach(listener => {
    if (listener.table === table && listener.event === 'INSERT') {
      listener.callback({ new: newRecord });
    }
  });
};

class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderConfig = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.insertRows = null;
    this.upsertRows = null;
    this.updateFields = null;
    this.isDelete = false;
    this.matchFilter = null;
  }

  select(columns) {
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  or(value) {
    this.filters.push({ type: 'or', column: 'or', value });
    return this;
  }

  order(column, config) {
    this.orderConfig = { column, ascending: config?.ascending !== false };
    return this;
  }

  match(filterObj) {
    this.matchFilter = filterObj;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(rows) {
    this.insertRows = rows;
    return this;
  }

  upsert(rows) {
    this.upsertRows = rows;
    return this;
  }

  update(fields) {
    this.updateFields = fields;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  async execute() {
    let data = await getMockData(this.table);

    // Apply delete
    if (this.isDelete) {
      const match = this.matchFilter;
      if (match) {
        data = data.filter(item => {
          return !Object.keys(match).every(k => String(item[k]) === String(match[k]));
        });
      } else {
        data = data.filter(item => {
          return !this.filters.every(f => {
            if (f.type === 'eq') return String(item[f.column]) === String(f.value);
            return true;
          });
        });
      }
      await setMockData(this.table, data);
      return { data: [], error: null };
    }

    // Apply update
    if (this.updateFields) {
      const updated = [];
      data = data.map(item => {
        const matches = this.filters.every(f => {
          if (f.type === 'eq') return String(item[f.column]) === String(f.value);
          return true;
        });
        if (matches) {
          const newItem = { ...item, ...this.updateFields };
          updated.push(newItem);
          return newItem;
        }
        return item;
      });
      await setMockData(this.table, data);
      return { data: updated, error: null };
    }

    // Apply insert
    if (this.insertRows) {
      const newRows = this.insertRows.map(row => ({
        id: row.id || Math.floor(Math.random() * 1000000) + 1,
        timestamp: row.timestamp || new Date().toISOString(),
        created_at: row.created_at || new Date().toISOString(),
        ...row
      }));
      data = [...data, ...newRows];
      await setMockData(this.table, data);
      
      newRows.forEach(newRow => {
        publishInsert(this.table, newRow);
      });
      
      return { data: newRows, error: null };
    }

    // Apply upsert
    if (this.upsertRows) {
      const newRows = this.upsertRows.map(row => ({
        timestamp: row.timestamp || new Date().toISOString(),
        created_at: row.created_at || new Date().toISOString(),
        ...row
      }));

      newRows.forEach(row => {
        const idx = data.findIndex(item => item.id === row.id);
        if (idx >= 0) {
          data[idx] = { ...data[idx], ...row };
        } else {
          data.push(row);
        }
      });
      
      await setMockData(this.table, data);
      return { data: newRows, error: null };
    }

    // Apply filters for select
    if (this.filters.length > 0) {
      data = data.filter(item => {
        return this.filters.every(f => {
          if (f.type === 'eq') {
            return String(item[f.column]) === String(f.value);
          }
          if (f.type === 'or') {
            const matches = [...f.value.matchAll(/\.eq\.([a-zA-Z0-9_-]+)/g)];
            if (matches.length >= 2) {
              const id1 = matches[0][1];
              const id2 = matches[1][1];
              return (item.sender_id === id1 && item.receiver_id === id2) ||
                     (item.sender_id === id2 && item.receiver_id === id1);
            }
          }
          return true;
        });
      });
    }

    // Apply sorting
    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      data.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply single / maybeSingle
    if (this.isSingle || this.isMaybeSingle) {
      if (data.length === 0) {
        if (this.isSingle) {
          return { data: null, error: new Error('Item not found') };
        }
        return { data: null, error: null };
      }
      return { data: data[0], error: null };
    }

    return { data, error: null };
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Wrapper object for Supabase Client
export const supabase = {
  auth: {
    getSession: async () => {
      if (currentSession) {
        return { data: { session: currentSession }, error: null };
      }
      try {
        return await realSupabase.auth.getSession();
      } catch (e) {
        console.warn('Real Supabase getSession failed:', e.message);
        return { data: { session: null }, error: null };
      }
    },
    
    getUser: async () => {
      if (currentSession) {
        return { data: { user: currentSession.user }, error: null };
      }
      try {
        return await realSupabase.auth.getUser();
      } catch (e) {
        console.warn('Real Supabase getUser failed:', e.message);
        return { data: { user: null }, error: null };
      }
    },

    signInWithPassword: async ({ email, password }) => {
      const normalized = normalizeEmail(email);
      if ((normalized === 'dev_test@example.com' || normalized === 'dev_test_doctor@example.com') && password === 'aidar') {
        const role = normalized === 'dev_test@example.com' ? 'patient' : 'doctor';
        const userId = normalized === 'dev_test@example.com' ? 'mock-patient-id' : 'mock-doctor-id';
        const fullName = normalized === 'dev_test@example.com' ? 'dev_test' : 'dev_test_doctor';
        
        const mockUser = {
          id: userId,
          email: normalized,
          user_metadata: {
            full_name: fullName,
            role: role,
            phone_number: '111',
            affiliation: role === 'doctor' ? 'Клиника DiabEase' : null,
            description: role === 'doctor' ? 'Тестовый аккаунт врача' : 'Тестовый аккаунт пациента'
          }
        };
        
        const session = {
          access_token: 'mock-access-token',
          user: mockUser
        };
        
        currentSession = session;
        await AsyncStorage.setItem('@mock_session', JSON.stringify(session));
        
        listeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { session, user: mockUser }, error: null };
      }
      
      return await realSupabase.auth.signInWithPassword({ email, password });
    },

    signUp: async ({ email, password, options }) => {
      const normalized = normalizeEmail(email);
      if ((normalized === 'dev_test@example.com' || normalized === 'dev_test_doctor@example.com') && password === 'aidar') {
        return supabase.auth.signInWithPassword({ email: normalized, password });
      }
      
      try {
        return await realSupabase.auth.signUp({ email, password, options });
      } catch (err) {
        if (err.message?.includes('Network') || err.message?.includes('fetch failed')) {
          console.warn('Real Supabase signUp failed due to network, creating mock account locally...');
          
          const role = options?.data?.role || 'patient';
          const fullName = options?.data?.full_name || 'New Mock User';
          const phoneNumber = options?.data?.phone_number || '111';
          const userId = 'mock-' + Math.random().toString(36).substr(2, 9);
          
          const mockUser = {
            id: userId,
            email: normalized,
            user_metadata: {
              full_name: fullName,
              role: role,
              phone_number: phoneNumber,
              affiliation: options?.data?.affiliation || null,
              description: options?.data?.description || null
            }
          };
          
          const session = {
            access_token: 'mock-access-token',
            user: mockUser
          };
          
          const profiles = await getMockData('profiles');
          profiles.push({
            id: userId,
            email: normalized,
            full_name: fullName,
            role: role,
            phone_number: phoneNumber,
            assigned_doctor_id: role === 'patient' ? 'mock-doctor-id' : null,
            affiliation: options?.data?.affiliation || null,
            description: options?.data?.description || null
          });
          await setMockData('profiles', profiles);
          
          currentSession = session;
          await AsyncStorage.setItem('@mock_session', JSON.stringify(session));
          
          listeners.forEach(cb => cb('SIGNED_IN', session));
          return { data: { session, user: mockUser }, error: null };
        }
        throw err;
      }
    },

    signOut: async () => {
      if (currentSession) {
        currentSession = null;
        await AsyncStorage.removeItem('@mock_session');
        listeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      }
      return await realSupabase.auth.signOut();
    },

    onAuthStateChange: (callback) => {
      listeners.push(callback);
      
      let realUnsubscribe = () => {};
      try {
        const { data: { subscription } } = realSupabase.auth.onAuthStateChange((event, session) => {
          if (!currentSession) {
            callback(event, session);
          }
        });
        realUnsubscribe = () => subscription.unsubscribe();
      } catch (e) {
        console.warn('Could not subscribe to real supabase auth change:', e.message);
      }
      
      callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = listeners.indexOf(callback);
              if (idx >= 0) {
                listeners.splice(idx, 1);
              }
              realUnsubscribe();
            }
          }
        }
      };
    }
  },

  from: (tableName) => {
    if (isMockSession()) {
      return new MockQueryBuilder(tableName);
    }
    return realSupabase.from(tableName);
  },

  channel: (name) => {
    const myListeners = [];
    const channelObj = {
      on: (eventConfig, filterConfig, callback) => {
        const table = filterConfig.table;
        const event = filterConfig.event;
        const listener = { table, event, callback };
        myListeners.push(listener);
        return {
          subscribe: () => {
            channelListeners.push(...myListeners);
            return channelObj;
          }
        };
      },
      _listeners: myListeners
    };
    return channelObj;
  },

  removeChannel: (chan) => {
    if (chan && chan._listeners) {
      chan._listeners.forEach(listener => {
        const idx = channelListeners.indexOf(listener);
        if (idx >= 0) {
          channelListeners.splice(idx, 1);
        }
      });
    }
  }
};

