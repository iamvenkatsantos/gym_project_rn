// What api-bench.mjs calls. Every entry is a read: a PostgREST GET or a read-only RPC.
// Keep the column lists in step with the api.ts file named in the comment; the point is to time
// the same request the app sends. Read-only RPCs were checked against supabase/migrations (no
// insert/update/delete/notify in the body). check_in_qr, admin_check_in_qr, check_in_display,
// invite_by_code and start_workout_attendance are left out on purpose.
export const READ_RPCS = new Set([
  'my_attendance_today',
  'gym_attendance',
  'attendance_report',
  'is_platform_admin',
  'my_waitlist_positions',
  'admin_branches',
  'brand_overview',
  'my_gym_invites',
  'gym_moved_members',
  'can_set_up_gym',
  'revenue_by_month',
  'member_insights',
  'busiest_hours',
  'gym_people',
  'gym_people_page',
  'gym_people_counts',
  'gym_latest_memberships',
  'owner_dashboard_counts',
  'gym_renewals_due',
  'gym_payment_history_page',
  'membership_receipt',
  'history_gyms',
  'my_referrals',
  'gym_referrals',
  'export_payments',
  'export_memberships',
  'export_attendance',
  'branch_subscription',
  'branch_access',
  'trainer_hours_month',
  'trainer_busy_slots',
]);

// Develop only. Sent with an empty or invalid body so the function rejects it at validation:
// measures routing + cold start without sending mail, WhatsApp, push or touching Razorpay.
export const EDGE_PROBES = [
  'invite-member',
  'accept-invite',
  'reset-password',
  'import-members',
  'create-payment',
  'create-subscription-payment',
  'delete-account',
  'join',
  'send-push',
].map((name) => ({ name, body: {} }));

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const q = (s) => encodeURIComponent(s);

// Which role runs what. Staff-only calls would just 403/empty for a member, so skip them.
const STAFF = ['owner', 'supervisor'];
const COACH = ['owner', 'supervisor', 'trainer'];

export async function buildCalls(ctx) {
  const { role, userId, call } = ctx;
  const rpc = (name, body = {}) => ({
    name,
    type: 'rpc',
    method: 'POST',
    path: `/rest/v1/rpc/${name}`,
    body,
  });
  const get = (name, path) => ({ name, type: 'table', method: 'GET', path: `/rest/v1/${path}` });

  // Discover ids with the test user's own session (not logged or saved).
  const mine =
    (
      await call(
        'GET',
        `/rest/v1/gym_members?select=gym_id,role&user_id=eq.${userId}&status=eq.active&limit=1`,
      )
    ).json ?? [];
  const gymId = mine[0]?.gym_id;
  const out = [];
  if (role === 'admin') {
    out.push(
      rpc('is_platform_admin'),
      rpc('admin_branches'),
      get(
        'platform_settings',
        'platform_settings?select=branch_fee_cents,online_addon_cents,online_cut_bps,currency&limit=1',
      ),
    );
    return out;
  }
  if (!gymId) return out;
  const gym = (await call('GET', `/rest/v1/gyms?select=brand_id&id=eq.${gymId}`)).json?.[0];
  const people =
    STAFF.includes(role) || role === 'trainer'
      ? ((await call('POST', '/rest/v1/rpc/gym_people', { p_gym_id: gymId })).json ?? [])
      : [];
  const memberId = role === 'member' ? userId : people.find((p) => p.role === 'member')?.user_id;
  const trainerId = role === 'trainer' ? userId : people.find((p) => p.role === 'trainer')?.user_id;
  const enquiryId = COACH.includes(role)
    ? (await call('GET', `/rest/v1/enquiries?select=id&gym_id=eq.${gymId}&limit=1`)).json?.[0]?.id
    : undefined;
  const membershipId = memberId
    ? (await call('GET', `/rest/v1/memberships?select=id&member_id=eq.${memberId}&limit=1`))
        .json?.[0]?.id
    : undefined;

  // Every role, app start (src/features/auth/api.ts, subscription, notifications).
  out.push(
    get(
      'profiles (me + gyms)',
      `profiles?select=*,gyms:gym_members!gym_members_user_id_fkey(*,gym:gyms(id,name,brand:brands(id,name)))&id=eq.${userId}`,
    ),
    get('contact_details (me)', `contact_details?select=phone,date_of_birth&user_id=eq.${userId}`),
    rpc('is_platform_admin'),
    rpc('my_gym_invites'),
    rpc('branch_access', { p_gym_id: gymId }),
    get(
      'notifications (inbox)',
      `notifications?select=id,recipient_id,kind,title,body,class_id,phone,created_at,read_at,sender:profiles!notifications_sender_id_fkey(full_name)&gym_id=eq.${gymId}&order=created_at.desc&limit=100`,
    ),
    rpc('my_attendance_today', { p_gym_id: gymId }),
    get(
      'announcements',
      `announcements?select=id,audience,title,body,created_at,sender:profiles!announcements_sender_id_fkey(full_name)&gym_id=eq.${gymId}&order=created_at.desc&limit=50`,
    ),
    get(
      'membership_plans',
      `membership_plans?select=*&gym_id=eq.${gymId}&active=eq.true&order=price_cents`,
    ),
    get(
      'exercises (library)',
      `exercises?select=*&or=(gym_id.is.null,gym_id.eq.${gymId})&order=name`,
    ),
    get(
      'class_schedule (upcoming)',
      `class_schedule?select=*&gym_id=eq.${gymId}&starts_at=gt.${q(new Date().toISOString())}&order=starts_at`,
    ),
    get('trainer_profiles', `trainer_profiles?select=*&gym_id=eq.${gymId}`),
  );
  if (role === 'member') {
    out.push(
      get(
        'bookings (mine)',
        `bookings?select=id,class_id,member_id,status&member_id=eq.${userId}&status=in.(booked,waitlisted)`,
      ),
      rpc('my_waitlist_positions', { p_gym_id: gymId }),
      rpc('my_referrals', { p_gym_id: gymId }),
      get(
        'workout_logs (mine)',
        `workout_logs?select=*&gym_id=eq.${gymId}&member_id=eq.${userId}&order=completed_at.desc&limit=100`,
      ),
      get(
        'body_measurements',
        `body_measurements?select=*&member_id=eq.${userId}&order=measured_on.desc&limit=366`,
      ),
      get(
        'progress_photos',
        `progress_photos?select=id,pose,taken_on,storage_path&member_id=eq.${userId}&order=taken_on.desc`,
      ),
      get(
        'workouts (plans + exercises)',
        `workouts?select=id,title,level,exercises:workout_exercises(*)&order=created_at.desc&limit=50`,
      ),
      get(
        'meal_plan_assignments',
        `meal_plan_assignments?select=plan:meal_plans(*)&gym_id=eq.${gymId}&member_id=eq.${userId}`,
      ),
      rpc('history_gyms', { p_member_id: userId }),
    );
  }
  if (COACH.includes(role)) {
    // People and attendance lists are for owners and supervisors only; a trainer gets an error.
    if (STAFF.includes(role))
      out.push(
        rpc('gym_people', { p_gym_id: gymId }),
        rpc('gym_people_page', { p_gym_id: gymId, p_filter: 'all', p_query: '', p_limit: 50, p_offset: 0 }),
        rpc('gym_people_counts', { p_gym_id: gymId }),
        rpc('gym_attendance', { p_gym_id: gymId, p_days_ago: 0 }),
        rpc('attendance_report', { p_gym_id: gymId, p_days: 7 }),
      );
    out.push(
      get('member_trainers', `member_trainers?select=*&gym_id=eq.${gymId}`),
      get('trainer_requests', `trainer_requests?select=*&gym_id=eq.${gymId}&order=created_at.desc`),
      get('enquiries', `enquiries?select=*&gym_id=eq.${gymId}&order=created_at.desc&limit=1000`),
      rpc('gym_referrals', { p_gym_id: gymId, p_days: 14 }),
      get(
        'trainer_sessions (booked)',
        `trainer_sessions?select=*&gym_id=eq.${gymId}&status=eq.booked&order=starts_at`,
      ),
      get(
        'workouts (coach plans)',
        `workouts?select=id,title,level,exercises:workout_exercises(*)&order=created_at.desc&limit=50`,
      ),
      get('meal_plans', `meal_plans?select=*&gym_id=eq.${gymId}&order=updated_at.desc`),
    );
    if (trainerId)
      out.push(
        rpc('trainer_busy_slots', {
          p_trainer_id: trainerId,
          p_from: new Date().toISOString(),
          p_to: new Date(Date.now() + 14 * 864e5).toISOString(),
        }),
      );
    if (enquiryId)
      out.push(
        get(
          'enquiry_notes',
          `enquiry_notes?select=id,kind,body,created_at,author:profiles(full_name)&enquiry_id=eq.${enquiryId}&order=created_at.desc`,
        ),
      );
    if (memberId)
      out.push(
        get(
          'workout_logs (member view)',
          `workout_logs?select=*&gym_id=eq.${gymId}&member_id=eq.${memberId}&order=completed_at.desc&limit=100`,
        ),
        get(
          'body_measurements (member view)',
          `body_measurements?select=*&member_id=eq.${memberId}&order=measured_on.desc&limit=366`,
        ),
        get(
          'memberships (latest)',
          `memberships?select=*,plan:membership_plans!inner(*)&member_id=eq.${memberId}&plan.gym_id=eq.${gymId}&order=ends_on.desc&limit=1`,
        ),
        rpc('history_gyms', { p_member_id: memberId }),
      );
  }
  if (STAFF.includes(role)) {
    out.push(
      rpc('owner_dashboard_counts', { p_gym_id: gymId, p_today: day() }),
      rpc('gym_renewals_due', { p_gym_id: gymId, p_today: day(), p_limit: 2 }),
      rpc('gym_payment_history_page', { p_gym_id: gymId, p_query: '', p_limit: 50, p_offset: 0 }),
      rpc('gym_moved_members', { p_gym_id: gymId }),
      get(
        'gym_invites (pending)',
        `gym_invites?select=id,email,role,created_at,code,phone&gym_id=eq.${gymId}&order=created_at.desc`,
      ),
      get(
        'saved_offers',
        `saved_offers?select=id,audience,title,body&gym_id=eq.${gymId}&order=created_at.desc`,
      ),
    );
  }
  // Owner-only in the database (insights, exports, trainer hours, billing, brand view):
  // a supervisor gets an error from these, so they are not part of its calls.
  if (role === 'owner') {
    out.push(
      rpc('revenue_by_month', { p_gym_id: gymId, p_months: 6 }),
      rpc('member_insights', { p_gym_id: gymId }),
      rpc('busiest_hours', { p_gym_id: gymId, p_days: 30 }),
      rpc('export_memberships', { p_gym_id: gymId }),
      rpc('export_payments', { p_gym_id: gymId, p_from: day(-90), p_to: day() }),
      rpc('export_attendance', { p_gym_id: gymId, p_from: day(-90), p_to: day() }),
      rpc('trainer_hours_month', { p_gym_id: gymId, p_month: day().slice(0, 8) + '01' }),
      rpc('branch_subscription', { p_gym_id: gymId }),
      get('trainer_hour_rules', `trainer_hour_rules?select=*&gym_id=eq.${gymId}`),
      get(
        'work_permissions',
        `work_permissions?select=*&gym_id=eq.${gymId}&order=day.desc&limit=100`,
      ),
      get(
        'subscription_payments',
        `subscription_payments?select=*&gym_id=eq.${gymId}&order=created_at.desc&limit=50`,
      ),
    );
    if (gym?.brand_id) out.push(rpc('brand_overview', { p_brand_id: gym.brand_id }));
    if (membershipId) out.push(rpc('membership_receipt', { p_membership_id: membershipId }));
  }
  return out;
}
