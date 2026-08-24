/**
 * Reminder sender. Invoked once a minute by pg_cron.
 *
 * Finds contacts whose reminder is due, pushes to their owner's subscribed
 * browsers, then advances the reminder to its next occurrence.
 *
 * Two rules from the design, both load-bearing:
 *
 * 1. The server advances next_reminder_at only after sending; the client
 *    advances it only when the user taps "I reached out". Anything else and the
 *    two writers race, double-advancing or skipping occurrences.
 *
 * 2. Only users with at least one push subscription are processed at all. A
 *    mobile-only user's reminders are owned entirely by their device — if the
 *    server advanced them here, their overdue badge would silently clear
 *    without anyone ever being notified.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { computeNextReminder, parseSchedule } from '../_shared/schedule.ts';
import { reminderBody, reminderTitle } from '../_shared/reminderContent.ts';

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  talking_points: string | null;
  schedule_kind: 'recurring' | 'interval' | 'one_time';
  schedule_config: unknown;
  next_reminder_at: string | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
};

const env = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required secret: ${key}`);
  return value;
};

Deno.serve(async (request: Request): Promise<Response> => {
  const startedAt = Date.now();

  // Deployed with --no-verify-jwt, so this shared secret is the only gate.
  // Without it anyone could drive the send loop and burn through reminders.
  const expected = `Bearer ${env('CRON_SECRET')}`;
  if (request.headers.get('Authorization') !== expected) {
    console.warn('[send-reminders] rejected: bad or missing CRON_SECRET');
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

  const now = new Date();

  // Everyone who could actually receive a push. Fetched first because it also
  // decides which contacts we're allowed to touch at all.
  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, subscription');

  if (subsError) {
    console.error('[send-reminders] could not read subscriptions:', subsError.message);
    return json({ error: subsError.message }, 500);
  }

  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const row of (subscriptions ?? []) as SubscriptionRow[]) {
    const list = subsByUser.get(row.user_id) ?? [];
    list.push(row);
    subsByUser.set(row.user_id, list);
  }

  if (subsByUser.size === 0) {
    console.log('[send-reminders] no push subscribers; nothing to do');
    return json({ due: 0, sent: 0, advanced: 0, ms: Date.now() - startedAt });
  }

  const subscribedUserIds = [...subsByUser.keys()];

  const { data: dueContacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, user_id, name, talking_points, schedule_kind, schedule_config, next_reminder_at')
    .lte('next_reminder_at', now.toISOString())
    .in('user_id', subscribedUserIds)
    .order('next_reminder_at', { ascending: true })
    // A safety valve: a backlog shouldn't turn one run into a thousand pushes.
    // Whatever is left is picked up by the next minute's run.
    .limit(200);

  if (contactsError) {
    console.error('[send-reminders] could not read contacts:', contactsError.message);
    return json({ error: contactsError.message }, 500);
  }

  const due = (dueContacts ?? []) as ContactRow[];
  if (due.length === 0) {
    console.log(`[send-reminders] nothing due (${subscribedUserIds.length} subscriber(s))`);
    return json({ due: 0, sent: 0, advanced: 0, ms: Date.now() - startedAt });
  }

  // Timezones for just the owners involved.
  const ownerIds = [...new Set(due.map((c) => c.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', ownerIds);

  if (profilesError) {
    console.error('[send-reminders] could not read profiles:', profilesError.message);
    return json({ error: profilesError.message }, 500);
  }

  const zoneByUser = new Map<string, string>();
  for (const row of profiles ?? []) zoneByUser.set(row.id, row.timezone ?? 'UTC');

  let sent = 0;
  let failed = 0;
  let advanced = 0;
  const deadEndpoints: string[] = [];

  for (const contact of due) {
    const timeZone = zoneByUser.get(contact.user_id) ?? 'UTC';
    const title = reminderTitle(contact.name);
    const body = reminderBody(contact.talking_points);
    const payload = JSON.stringify({ title, body, contactId: contact.id });

    const targets = subsByUser.get(contact.user_id) ?? [];
    let deliveredToAny = false;

    for (const target of targets) {
      try {
        await webpush.sendNotification(target.subscription, payload);
        deliveredToAny = true;
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 mean the browser threw this subscription away. Keeping it
        // would fail on every future run forever.
        if (status === 404 || status === 410) {
          deadEndpoints.push(target.endpoint);
          console.log(`[send-reminders] dropping dead endpoint for user ${target.user_id}`);
        } else {
          failed += 1;
          console.error(
            `[send-reminders] push failed for ${contact.name} (status ${status ?? '?'}):`,
            (error as Error).message,
          );
        }
      }
    }

    // Computed from `now`, not from the reminder that just fired: if a run is
    // delayed or the project was paused, anchoring to a stale time could return
    // another past instant and the contact would be re-sent every minute.
    const schedule = parseSchedule(contact.schedule_kind, contact.schedule_config);
    const next = computeNextReminder(schedule, { from: now, afterContact: true, timeZone });

    const { error: updateError } = await supabase
      .from('contacts')
      .update({ next_reminder_at: next ? next.toISOString() : null })
      .eq('id', contact.id);

    if (updateError) {
      console.error(`[send-reminders] could not advance ${contact.name}:`, updateError.message);
    } else {
      advanced += 1;
      console.log(
        `[send-reminders] ${contact.name} (${timeZone}) delivered=${deliveredToAny} ` +
          `next=${next ? next.toISOString() : 'none'} body=${JSON.stringify(body.slice(0, 60))}`,
      );
    }
  }

  if (deadEndpoints.length > 0) {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', deadEndpoints);
    if (error) console.error('[send-reminders] could not delete dead endpoints:', error.message);
  }

  const summary = {
    due: due.length,
    sent,
    failed,
    advanced,
    droppedEndpoints: deadEndpoints.length,
    ms: Date.now() - startedAt,
  };
  console.log('[send-reminders] done', JSON.stringify(summary));
  return json(summary);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
