# CoreFit Gym demo video

[`corefit-gym-demo.mp4`](corefit-gym-demo.mp4) (1080p, about 3 minutes, no audio) walks a gym owner through the app, one role at a time:

| Time | Role       | What it shows                                                                                                                                   |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Intro      |                                                                                                                                                 |
| 0:05 | Gym owner  | Live dashboard, renewals due, Insights (revenue, lapsed members, busiest hours), attendance, enquiries, people, plans and payments, CSV reports |
| 1:05 | Supervisor | Front-desk dashboard, approving a trainer request, recording a UPI payment, sending a renewal reminder                                          |
| 1:44 | Trainer    | Today's schedule, coached members, a member's progress and body stats, workout and diet plans                                                   |
| 2:16 | Member     | Check-in, membership and trainers, a guided workout with exercise demos and set logging, progress charts, booking a class                       |

It is recorded from the app's demo mode (`npm run demo`), so every name, payment and check-in is sample data for a made-up gym, "Pulse Fitness Anna Nagar". The clock is set to a Tuesday evening, 6:40 pm IST, so the gym looks busy.

## Re-recording

After a UI change, run `demo/recording/make-video.sh`. It exports the demo build for web, opens `stage.html` (captions on the left, the app in a phone frame on the right) in Playwright, drives each role with `record.js`, and encodes the screen capture with ffmpeg. Captions and the order of scenes live in `record.js`.
