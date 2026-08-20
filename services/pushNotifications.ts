import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type ActionPerformed,
  type PluginListenerHandle,
  type Token,
} from '@capacitor/push-notifications';
import type { ViewState } from '../types';
import { supabase } from './supabase';

type NotificationOpenHandler = (view: ViewState) => void;

const ALLOWED_VIEWS = new Set<ViewState>([
  'DASHBOARD',
  'SETTINGS',
  'HELP_WIZARD',
  'ASSESSMENT',
  'EVENTS',
  'EVENT_DASHBOARD',
  'ORG_DASHBOARD',
]);

let initializedUserId: string | null = null;
let registeredToken: string | null = null;
let listenerHandles: PluginListenerHandle[] = [];

const removeListeners = async () => {
  await Promise.all(listenerHandles.map((handle) => handle.remove().catch(() => undefined)));
  listenerHandles = [];
};

const resolveNotificationView = (action: ActionPerformed): ViewState => {
  const requestedView = String(action.notification.data?.view || '').toUpperCase() as ViewState;
  return ALLOWED_VIEWS.has(requestedView) ? requestedView : 'DASHBOARD';
};

const saveDeviceToken = async (token: Token) => {
  const value = String(token.value || '').trim();
  if (!value) return;
  registeredToken = value;

  const { error } = await supabase.rpc('register_push_device_token', {
    p_token: value,
    p_platform: 'ios',
  });
  if (error) throw error;
};

export const initializePushNotifications = async (onOpen: NotificationOpenHandler) => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || initializedUserId === user.id) return;

  await removeListeners();
  initializedUserId = user.id;

  listenerHandles.push(
    await PushNotifications.addListener('registration', (token) => {
      void saveDeviceToken(token).catch((error) => console.warn('Unable to save push token', error));
    }),
    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push notification registration failed', error);
    }),
    await PushNotifications.addListener('pushNotificationReceived', () => {
      window.dispatchEvent(new CustomEvent('aera:push-notification'));
    }),
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      onOpen(resolveNotificationView(action));
    }),
  );

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive === 'granted') {
    await PushNotifications.register();
  }
};

export const deactivatePushNotificationsForCurrentUser = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (registeredToken) {
      await supabase.rpc('deactivate_push_device_token', { p_token: registeredToken });
    }
  } finally {
    initializedUserId = null;
    registeredToken = null;
    await removeListeners();
  }
};
