import React, { useRef, useState } from 'react';
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
  onContinueAsGuest: () => void;
}

export default function Auth({ onSuccess, onContinueAsGuest }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingGoogleLink, setPendingGoogleLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const authInProgressRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'create' | 'google' | 'login' | 'reset' | null>(null);

  const clearMessages = () => {
    setError(null);
    setMessage(null);
    setErrorAction(null);
  };

  const handleGoogleSignIn = async () => {
    if (authInProgressRef.current) return;
    authInProgressRef.current = true;
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
      authInProgressRef.current = false;
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    if (authInProgressRef.current || loading) return;
    onContinueAsGuest();
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
    <div className="forge-auth relative">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="forge-orb forge-animate-orb-drift absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/6" />
        <div className="forge-orb forge-animate-orb-drift-2 absolute -bottom-48 -right-32 h-[40rem] w-[40rem] rounded-full bg-indigo-500/6" />
      </div>
      <section className="forge-auth-story relative">
        <div className="forge-auth-story-inner">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BrandLogo />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="forge-auth-kicker"
          >
            Built for the job search
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Build a resume that looks professional and gets you interview-ready.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Create focused, professional resumes with an editor designed around how recruiters
            review technical candidates.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="forge-auth-benefits"
          >
            {['Clear structure', 'Professional templates', 'Consistent PDF export'].map((item, idx) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + idx * 0.1 }}
              >
                <Check />
                {item}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="forge-resume-mockup"
            aria-hidden="true"
          >
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
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.8, type: 'spring', stiffness: 200 }}
              className="forge-mockup-score"
            >
              <strong>PDF</strong>
              <span>Export ready</span>
            </motion.div>
          </motion.div>
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
                : 'Sign in to access your resumes and workspace.'}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {error && (
              <motion.div id="auth-form-error" className="forge-alert is-error" role="alert" aria-live="assertive">
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

          <form onSubmit={handleSubmit} className="forge-auth-form" noValidate>
            <label>
              <span>Email address</span>
              <div>
                <Mail />
                <input
                  type="email"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'auth-form-error' : undefined}
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

          <div className="mt-5 border-t border-white/5 pt-5">
            <div className="mb-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] p-4 text-left">
              <p className="text-sm font-semibold text-white">Just want to build?</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Continue as Guest to create, edit, preview, and export a resume without signing in.
              </p>
            </div>
            <button
              type="button"
              onClick={handleContinueAsGuest}
              disabled={loading}
              className="w-full rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              aria-label="Continue in guest mode"
            >
              {loading ? 'Finishing sign in…' : 'Continue as guest'}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">
              You&apos;re using Forge as Guest. Your work is saved locally on this device and is never auto-imported into an account.
            </p>
          </div>

          <div className="forge-auth-divider"><span>or</span></div>
          <button type="button" className="forge-google-button" onClick={handleGoogleSignIn} disabled={loading} aria-label={mode === 'register' ? 'Create account with Google' : 'Sign in with Google'}>
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
