const { setup, sleep } = require('./lib');
const record = process.argv[2] === 'rec';
const only = process.argv[3];

const roleCard = (n, name, line) =>
  `<img src="logo.png"/><div class="k">Role ${n} of 4</div><h1>${name}</h1><p>${line}</p>`;

(async () => {
  const d = await setup({ record, outDir: 'frames' });
  const { app, page } = d;
  const say = async (t, s, ms = 0) => {
    await d.caption(t, s);
    await sleep(ms);
  };

  // Lets one scene fail during a dry run without losing the rest.
  const scene = async (name, fn) => {
    if (only && only !== name) return;
    try {
      await fn();
    } catch (e) {
      console.log('SCENE FAIL', name, e.message.split('\n')[0]);
      await d.snap('fail-' + name);
    }
  };

  await d.card(
    `<img src="logo.png"/><h1>CoreFit Gym</h1><p>One app to run your gym, for the owner, the front desk, the trainers and every member.</p><div class="roles"><div>Owner</div><div>Supervisor</div><div>Trainer</div><div>Member</div></div>`,
  );
  await d.start();
  await sleep(5000);

  await scene('owner', async () => {
    await d.card(roleCard(1, 'Gym owner', 'The whole business, live, from your phone.'));
    await d.role('Owner');
    await d.caption(
      'Each person signs in to their own app',
      'Owners, supervisors, trainers and members each see only the screens for their role.',
    );
    await d.loadApp();
    await sleep(1200);
    await d.card(null);
    await sleep(2500);
    await d.tap('Gym owner', 600);
    await say(
      'Your gym, live',
      "Active members, renewals due, who came in today, trainers on the floor and today's classes.",
      4500,
    );
    await say(
      'Renewals never slip',
      'Members whose plan has ended or ends this week, with one-tap Renew and Remind.',
    );
    await d.scroll(820, 30, 4000);
    await d.scroll(-820, 20, 600);
    await say(
      'Know your numbers',
      'Revenue by month, new members, who has lapsed and your busiest hours.',
    );
    await d.tap('Insights', 2500);
    await d.scroll(620, 30, 2800);
    await d.scroll(700, 30, 2800);
    await d.back(800);
    await say(
      'Attendance, today and every day',
      'Who came in, how long they stayed, which trainers are in and who is in the gym now.',
    );
    await d.tap('Attendance', 3000);
    await d.scroll(560, 30, 2600);
    await d.back(800);
    await say(
      'Turn walk-ins into members',
      'Log enquiries, get reminded to follow up, give trial passes and convert them in one tap.',
    );
    await d.tap('Enquiries', 3800);
    await d.back(800);
    await say(
      'Everyone in one place',
      "Invite members and staff by email and see each member's trainer.",
    );
    await d.tab('People', 2500);
    await d.scroll(500, 25, 2200);
    await say(
      'Plans and payments',
      'Set your membership plans and record cash, UPI, card or bank payments.',
    );
    await d.tab('Payments', 2600);
    await d.scroll(720, 30, 2600);
    await say(
      'Reports for your accountant',
      'Export payments, memberships and attendance as Excel-ready files for any period.',
    );
    await d.tab('Dashboard', 900);
    await d.tap('Reports', 3800);
  });

  await scene('supervisor', async () => {
    await d.card(
      roleCard(2, 'Supervisor', 'Runs the front desk: payments, renewals and trainer matching.'),
    );
    await d.role('Supervisor');
    await d.loadApp();
    await d.tap('Supervisor', 400);
    await d.caption(
      'The front desk view',
      'The same live dashboard, without owner-only insights, reports and gym settings.',
    );
    await sleep(1200);
    await d.card(null);
    await sleep(3500);
    await say(
      'Match members with trainers',
      'A member asks for a trainer. The supervisor approves and assigns in one tap.',
    );
    await d.tap('Asked for Divya Raman · 5 h ago', 2200, false);
    const note = app
      .getByPlaceholder(/Divya trains you/)
      .filter({ visible: true })
      .first();
    await d.tapOn(note, 300);
    await page.keyboard.type('Divya will meet you on Monday at 7 pm.', { delay: 45 });
    await sleep(700);
    await d.tap('Approve and assign', 2600);
    await say(
      'Record a payment in seconds',
      'Pick the member, plan and payment method. The new membership starts the day after the current one ends.',
    );
    await d.tab('Payments', 1200);
    await d.tap('Record a payment', 1500);
    const search = app.getByPlaceholder('Name or email').filter({ visible: true }).first();
    await d.tapOn(search, 300);
    await page.keyboard.type('Harish', { delay: 90 });
    await sleep(900);
    await d.tap('Harish Patel', 1800);
    await d.scroll(600, 30, 1200);
    await d.tap('UPI', 1200);
    await d.tap('Record ₹1,499.00 payment', 2800, false);
    await say(
      'Nudge members to renew',
      "Remind sends a push notification straight to the member's phone.",
    );
    await d.tab('Dashboard', 1200);
    await d.scroll(560, 30, 1500);
    await d.tap('Remind', 2800);
  });

  await scene('trainer', async () => {
    await d.card(
      roleCard(3, 'Trainer', 'Coaches members and builds their workout and diet plans.'),
    );
    await d.role('Trainer');
    await d.loadApp();
    await d.tap('Trainer', 400);
    await d.caption('My day', 'Shift check-in, bookable hours, upcoming 1:1 sessions and classes.');
    await sleep(1200);
    await d.card(null);
    await sleep(3200);
    await d.scroll(620, 30, 2600);
    await say('My members', 'Every member this trainer coaches, with the plan they are on.');
    await d.tab('Members', 2800);
    await say(
      "Follow each member's progress",
      'Workouts done, week streaks, personal records and body measurements.',
    );
    await d.tap('Nandini Ravi', 2600);
    await d.scroll(600, 30, 2200);
    await d.tap('Body', 3000);
    await d.back(800);
    await say(
      'Build and assign plans',
      'Write workout plans from a 100+ exercise library and assign them to members.',
    );
    await d.tab('My workouts', 3200);
    await say('Diet plans too', 'Meal-by-meal diet plans, one per member.');
    await d.tap('Diet', 3600);
  });

  await scene('member', async () => {
    await d.card(roleCard(4, 'Member', 'Their gym, in their pocket.'));
    await d.role('Member');
    await d.loadApp();
    await d.tap('Member', 400);
    await d.caption(
      'Check in at the gym',
      'Members check in when they arrive, and the front desk sees it live.',
    );
    await sleep(1200);
    await d.card(null);
    await sleep(2500);
    await d.tap('Check in', 2500);
    await say(
      'Their plan and their trainers',
      'Days left on the membership, gym announcements, trainers and what is coming up.',
    );
    await d.scroll(700, 30, 3500);
    await say(
      'Workouts from their trainer',
      'Start the plan the trainer assigned, with photo demos of every exercise.',
    );
    await d.tab('Workouts', 2500);
    await d.tap('Start workout', 1800);
    await d.tap('Show demo', 3200);
    await say('Log every set', 'Tick off sets as they go. A rest timer starts after each one.');
    await d.tapOn(
      app.getByLabel('Goblet squat set 1 done').filter({ visible: true }).first(),
      2500,
    );
    await d.tap('Skip', 900);
    await d.tapOn(
      app.getByLabel('Goblet squat set 2 done').filter({ visible: true }).first(),
      1500,
    );
    await d.tap('Skip', 900);
    await d.scroll(2500, 40, 600);
    await d.tap('Finish workout', 2600);
    await say(
      'Progress they can see',
      'Personal records, workout history, and weight and body-fat trends.',
    );
    await d.scroll(400, 20, 1800);
    await d.scroll(-400, 15, 400);
    await d.tap('Body', 3500);
    await say(
      'Book classes and personal training',
      'See open spots, book a class or a 1:1 session with their trainer.',
    );
    await d.tab('Bookings', 1200);
    await d.tap('Classes', 1500);
    await d.tap('28', 1500);
    await d.tap('Book class', 3000);
  });

  await d.card(
    `<img src="logo.png"/><h1>CoreFit Gym</h1><p>Members · Payments · Renewals · Attendance · Trainers · Diet · Reports</p><div class="roles"><div>Android app</div><div>iPhone app</div><div>Owner web dashboard</div></div>`,
  );
  await sleep(5500);
  const frames = await d.stop();
  if (record) require('fs').writeFileSync('frames.json', JSON.stringify(frames));
  console.log('frames', frames.length);
})();
