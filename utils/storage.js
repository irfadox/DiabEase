import { supabase } from './supabase';

/**
 * LOGS (Diary entries)
 */
export const saveLog = async (log) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('logs')
      .insert([
        {
          user_id: user.id,
          sugar_level: parseFloat(log.value),
          notes: log.notes,
          status: log.status,
          timestamp: new Date().toISOString(),
        },
      ])
      .select();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Error saving log to Supabase', e);
    return null;
  }
};

export const getLogs = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Error getting logs from Supabase', e);
    return [];
  }
};

/**
 * REMINDERS
 */
export const saveReminders = async (reminders) => {
  // Supabase implementation: We usually sync individual reminders, 
  // but if the app expects a full list replacement:
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // This is a simplified version. In a real app, you'd upsert or sync individual items.
    // For this prototype, we'll clear and re-insert if needed, or just handle single adds.
    // Let's assume Screen calls this for updates.
  } catch (e) {
    console.error('Error saving reminders', e);
  }
};

export const addReminder = async (reminder) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('reminders')
            .insert([{
                user_id: user.id,
                title: reminder.title,
                time: reminder.time,
                type: reminder.type,
                completed: false
            }])
            .select();
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error adding reminder', e);
    }
}

export const getReminders = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Error getting reminders', e);
    return [];
  }
};

/**
 * CHAT HISTORY
 */
export const saveChatMessage = async (message) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !message.receiver_id) return null;

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.id,
          receiver_id: message.receiver_id,
          text: message.text,
          is_sos: Boolean(message.is_sos),
          is_system: Boolean(message.is_system),
          timestamp: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Error saving chat message', e);
  }
};

export const getChatHistory = async (partnerId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !partnerId) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Error getting chat history', e);
    return [];
  }
};

/**
 * DELETE FUNCTIONS
 */
export const deleteLog = async (id) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('logs')
            .delete()
            .match({ id, user_id: user.id });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error deleting log', e);
        return false;
    }
};

export const deleteReminder = async (id) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('reminders')
            .delete()
            .match({ id, user_id: user.id });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error deleting reminder', e);
        return false;
    }
};
