/**
 * Re-exported from the shared module so the reminder sender builds notification
 * text with exactly the same rules as the app.
 */
export {
  GENERIC_REMINDER_BODY,
  reminderBody,
  reminderTitle,
} from '../../supabase/functions/_shared/reminderContent';
