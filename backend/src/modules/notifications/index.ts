export { notificationRoutes } from './notification.routes.js'
export {
  dispatch,
  dispatchToMany,
  sendPushToUser,
  sendPushToUsers,
  getUserPreferences,
  updateUserPreferences,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  listNotifications,
  registerDeviceToken,
  deactivateDeviceToken,
} from './notification.service.js'
export type {
  CreateNotificationPayload,
  NotificationType,
  NotificationCategory,
  NotificationRole,
  NotificationChannel,
  NotificationPreferences,
  NotificationMetadata,
} from './notification.types.js'
