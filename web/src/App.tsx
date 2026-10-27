import { GymProvider, useOwnedGyms, useSession, useSignOut } from './auth/session';
import { Layout } from './components/Layout';
import { QueryState } from './components/ui';
import { displayKeyFromHash, usePage, type Page } from './lib/route';
import { Attendance } from './pages/Attendance';
import { CheckIn } from './pages/CheckIn';
import { Display } from './pages/Display';
import { Exports } from './pages/Exports';
import { Members } from './pages/Members';
import { Overview } from './pages/Overview';
import { Payments } from './pages/Payments';
import { SignIn } from './pages/SignIn';

const SCREENS: Record<Page, () => React.JSX.Element> = {
  overview: Overview,
  members: Members,
  payments: Payments,
  attendance: Attendance,
  'check-in': CheckIn,
  exports: Exports,
};

export function App() {
  // The front-desk display is public: it shows only the rotating code.
  const displayKey = displayKeyFromHash();
  if (displayKey) return <Display displayKey={displayKey} />;
  return <Dashboard />;
}

function Dashboard() {
  const session = useSession();
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return <OwnerGate userId={session.user.id} email={session.user.email ?? ''} />;
}

/** Only gym owners get past here; everyone else is told to use the app. */
function OwnerGate({ userId, email }: { userId: string; email: string }) {
  const gyms = useOwnedGyms(userId);
  const signOut = useSignOut();
  const [page, setPage] = usePage();

  return (
    <QueryState query={gyms}>
      {(owned) => {
        if (owned.length === 0) {
          return (
            <main className="auth">
              <div className="card">
                <h1>Owners only</h1>
                <p className="muted">
                  {email} doesn’t own a gym on CoreFit Gym. The web dashboard is for gym owners;
                  members, trainers and supervisors can do everything in the app.
                </p>
                <button className="button" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </main>
          );
        }
        const Screen = SCREENS[page];
        return (
          <GymProvider gyms={owned} email={email}>
            <Layout page={page} onNavigate={setPage} onSignOut={signOut}>
              <Screen />
            </Layout>
          </GymProvider>
        );
      }}
    </QueryState>
  );
}
