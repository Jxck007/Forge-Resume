import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import {
  AuthActionError,
  clearPendingGoogleLink,
  handleForgotPassword,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
} from '../services/firebase';
import BrandLogo from './BrandLogo';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingGoogleLink, setPendingGoogleLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'create' | 'google' | 'login' | 'reset' | null>(null);

  const clearMessages = () => {
    setError(null);
    setMessage(null);
    setErrorAction(null);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setPendingGoogleLink(false);
    clearMessages();
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof AuthActionError && error.code === 'auth/account-exists-with-different-credential') {
        if (error.email) setEmail(error.email);
        const methods = error.signInMethods || [];
        const canVerifyWithPassword = methods.length === 0 || methods.includes('password');
        if (canVerifyWithPassword) {
          setMode('login');
          setPendingGoogleLink(true);
        }
      }
      if (error instanceof AuthActionError && error.code === 'auth/use-google') {
        setErrorAction('google');
      }
      setError(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      if (!email.trim()) throw new Error('Enter a valid email address.');
      if (mode === 'login') {
        if (!password) throw new Error('Enter your password.');
        await loginWithEmail(email, password);
        setPendingGoogleLink(false);
        onSuccess();
      } else if (mode === 'register') {
        if (password.length < 6) throw new Error('Use at least 6 characters for your password.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await registerWithEmail(email, password);
        onSuccess();
      } else {
        await handleForgotPassword(email);
        setMessage('Password reset instructions were sent to your email.');
      }
    } catch (error: unknown) {
      if (error instanceof AuthActionError) {
        if (error.email) setEmail(error.email);
        if (error.code === 'auth/use-google') setErrorAction('google');
        else if (error.code === 'auth/account-not-found') setErrorAction('create');
        else if (error.code === 'auth/email-already-in-use') setErrorAction('login');
        else if (error.code === 'auth/wrong-password') setErrorAction('reset');
      }
      setError(error instanceof Error ? error.message : 'We could not complete that request.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register' | 'forgot') => {
    clearMessages();
    clearPendingGoogleLink();
    setPendingGoogleLink(false);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMode(nextMode);
  };

  return (
    <div className="forge-auth">
      <section className="forge-auth-story">
        <div className="forge-auth-story-inner">
          <BrandLogo />
          <div className="forge-auth-kicker">Built for the job search</div>
          <h1>Build a resume that clears ATS filters and earns interviews.</h1>
          <p>
            Create focused, professional resumes with an editor designed around how recruiters
            review technical candidates.
          </p>
          <div className="forge-auth-benefits">
            {['ATS-first structure', 'Professional templates', 'Consistent PDF export'].map(item => (
              <span key={item}><Check />{item}</span>
            ))}
          </div>

          <div className="forge-resume-mockup" aria-hidden="true">
            <div className="forge-resume-paper">
              <div className="forge-resume-head">
                <span />
                <div><b /><i /></div>
              </div>
              <div className="forge-resume-rule" />
              <div className="forge-resume-columns">
                <div>
                  <b />
                  <span /><span /><span />
                  <b />
                  <span /><span />
                </div>
                <div>
                  <b />
                  <span /><span /><span /><span />
                  <b />
                  <span /><span /><span />
                </div>
              </div>
            </div>
            <div className="forge-mockup-score">
              <strong>92</strong>
              <span>ATS ready</span>
            </div>
          </div>
        </div>
      </section>

      <section className="forge-auth-panel">
        <div className="forge-auth-mobile-logo"><BrandLogo /></div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="forge-auth-card"
        >
          <div className="forge-auth-heading">
            <span>{mode === 'register' ? 'Start building' : mode === 'forgot' ? 'Account recovery' : 'Welcome back'}</span>
            <h2>
              {mode === 'register' ? 'Create your Forge account' : mode === 'forgot' ? 'Reset your password' : 'Continue your Forge Journey'}
            </h2>
            <p>
              {mode === 'register'
                ? 'Set up your career workspace in less than a minute.'
                : mode === 'forgot'
                ? 'We will send a secure reset link to your inbox.'
                : 'Sign in to access your resumes and ATS reports.'}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {error && (
              <motion.div className="forge-alert is-error" role="alert" aria-live="assertive">
                <span>{error}</span>
                {errorAction && (
                  <button
                    type="button"
                    onClick={() => {
                      if (errorAction === 'google') handleGoogleSignIn();
                      else if (errorAction === 'create') switchMode('register');
                      else if (errorAction === 'login') switchMode('login');
                      else switchMode('forgot');
                    }}
                  >
                    {errorAction === 'google'
                      ? 'Continue with Google'
                      : errorAction === 'create'
                      ? 'Create account'
                      : errorAction === 'login'
                      ? 'Go to sign in'
                      : 'Reset password'}
                  </button>
                )}
              </motion.div>
            )}
            {message && <motion.div className="forge-alert is-success" role="status" aria-live="polite">{message}</motion.div>}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="forge-auth-form">
            <label>
              <span>Email address</span>
              <div>
                <Mail />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </label>

            {mode !== 'forgot' && (
              <label>
                <span>Password</span>
                <div>
                  <Lock />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    className="forge-password-toggle"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'register' && (
              <label>
                <span>Confirm password</span>
                <div>
                  <Lock />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="forge-password-toggle"
                    onClick={() => setShowConfirmPassword(current => !current)}
                    aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'login' && (
              <button type="button" className="forge-text-button" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}

            <button type="submit" className="forge-primary-button" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {mode === 'login'
                ? pendingGoogleLink ? 'Sign in and link Google' : 'Sign in'
                : mode === 'register' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="forge-auth-divider"><span>or</span></div>
          <button type="button" className="forge-google-button" onClick={handleGoogleSignIn} disabled={loading}>
            <span>G</span> {mode === 'register' ? 'Create account with Google' : 'Sign in with Google'}
          </button>
          <p className="forge-google-help">
            Existing Google users are signed in automatically. If this email uses a password, Forge Resume will guide you through secure account linking.
          </p>

          <div className="forge-auth-switch">
            {mode === 'login' && <>New to Forge? <button onClick={() => switchMode('register')}>Create an account</button></>}
            {mode === 'register' && <>Already have an account? <button onClick={() => switchMode('login')}>Sign in</button></>}
            {mode === 'forgot' && <button onClick={() => switchMode('login')}>Return to sign in</button>}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
