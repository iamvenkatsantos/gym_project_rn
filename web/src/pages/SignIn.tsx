import { useState, type FormEvent } from 'react';

import { MIN_PASSWORD } from '@/lib/validation';

import { errorMessage } from '../components/ui';
import { supabase } from '../lib/supabase';

type Mode = 'signIn' | 'forgot' | 'reset';

/**
 * Owners sign in with the same email and password as the app. A forgotten
 * password is reset with the 6-digit code from the CoreFit Gym email.
 */
export function SignIn() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (e: FormEvent, action: () => Promise<void>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const signIn = (e: FormEvent) =>
    run(e, async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    });

  const sendCode = (e: FormEvent) =>
    run(e, async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setPassword('');
      setMode('reset');
      setInfo(`We emailed a 6-digit code to ${email.trim()}.`);
    });

  const reset = (e: FormEvent) =>
    run(e, async () => {
      if (password.length < MIN_PASSWORD) {
        throw new Error(`Use at least ${MIN_PASSWORD} characters for the new password`);
      }
      const verified = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });
      if (verified.error) throw verified.error;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    });

  const onSubmit = mode === 'signIn' ? signIn : mode === 'forgot' ? sendCode : reset;

  return (
    <main className="auth">
      <form className="card" onSubmit={onSubmit}>
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            CoreFit Gym
            <small>Owner dashboard</small>
          </div>
        </div>
        <div>
          <h1>{mode === 'signIn' ? 'Sign in' : 'Reset password'}</h1>
          <p className="muted">
            {mode === 'signIn'
              ? 'Use the email and password you use in the CoreFit Gym app.'
              : mode === 'forgot'
                ? 'We’ll email you a code to set a new password.'
                : 'Enter the code from the email and pick a new password.'}
          </p>
        </div>

        <label className="field">
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={mode === 'reset'}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode === 'reset' ? (
          <label className="field">
            Code
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        ) : null}
        {mode !== 'forgot' ? (
          <label className="field">
            {mode === 'reset' ? 'New password' : 'Password'}
            <input
              className="input"
              type="password"
              autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : null}

        {info ? <div className="notice">{info}</div> : null}
        {error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : null}

        <button className="button primary" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'signIn'
              ? 'Sign in'
              : mode === 'forgot'
                ? 'Email me a code'
                : 'Set password and sign in'}
        </button>
        <button
          className="button link"
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'forgot' : 'signIn');
            setError(null);
            setInfo(null);
          }}>
          {mode === 'signIn' ? 'Forgot password?' : 'Back to sign in'}
        </button>
      </form>
    </main>
  );
}
