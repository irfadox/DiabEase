import { Alert, Platform } from 'react-native';

export const showAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    const text = title ? `${title}\n\n${message || ''}` : (message || '');
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(text);
      const action = buttons.find(b => confirmed ? (b.style !== 'cancel') : (b.style === 'cancel'));
      if (action && action.onPress) action.onPress();
    } else {
      window.alert(text);
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};
