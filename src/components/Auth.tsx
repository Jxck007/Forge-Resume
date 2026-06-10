import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, handleForgotPassword } from '../services/firebase';
import { Sparkles, Mail, Lock, UserPlus, LogIn, Key, Loader2, ArrowRight } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setMessage(null);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    clearMessages();
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    if (!email) {
      setError('Please provide a valid email address.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        if (!password) {
          setError('Please provide your password.');
          setLoading(false);
          return;
        }
        await loginWithEmail(email, password);
        onSuccess();
      } else if (mode === 'register') {
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password);
        onSuccess();
      } else {
        await handleForgotPassword(email);
        setMessage('A password reset link has been dispatched to your email.');
      }
    } catch (err: any) {
      let friendlyError = err?.message || 'Access authorization failed.';
      if (err?.code === 'auth/user-not-found') {
        friendlyError = 'No profile was found with this email.';
      } else if (err?.code === 'auth/wrong-password') {
        friendlyError = 'Incorrect password specification.';
      } else if (err?.code === 'auth/email-already-in-use') {
        friendlyError = 'This email is already associated with an account.';
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0F1115] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Hero Illustration Side (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0b0e] border-r border-[#2A2E37] items-center justify-center overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="relative z-10 flex flex-col items-center justify-center p-12 max-w-lg">
          <div className="mb-8 p-4 rounded-3xl bg-[#171A21] border border-[#2A2E37] shadow-2xl flex items-center justify-center">
             <Sparkles className="h-10 w-10 text-indigo-500" />
          </div>
          <h1 className="text-4xl font-extrabold text-white text-center tracking-tight mb-4 leading-tight">
            Design your professional future.
          </h1>
          <p className="text-zinc-400 text-center text-lg leading-relaxed mb-12">
            Build ATS-optimized, beautifully formatted resumes in minutes. Powered by intelligent formatting and AI precision.
          </p>

          {/* Abstract Resume Graphic */}
          <div className="w-full max-w-md bg-[#171A21] rounded-2xl border border-[#2A2E37] p-6 shadow-2xl skew-y-3 transform transition-transform hover:skew-y-0 duration-500">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-zinc-700 rounded-full w-1/3"></div>
                <div className="h-2 bg-zinc-800 rounded-full w-1/4"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-2 bg-zinc-800 rounded-full w-full"></div>
              <div className="h-2 bg-zinc-800 rounded-full w-5/6"></div>
              <div className="h-2 bg-zinc-800 rounded-full w-4/6"></div>
            </div>
            <div className="mt-6 flex gap-2">
              <div className="h-6 w-16 bg-indigo-500/20 rounded-md border border-indigo-500/30"></div>
              <div className="h-6 w-20 bg-indigo-500/20 rounded-md border border-indigo-500/30"></div>
              <div className="h-6 w-14 bg-indigo-500/20 rounded-md border border-indigo-500/30"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Form Side */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        {/* Mobile only logo since desktop has it on the left */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
           <div className="p-2 rounded-lg bg-[#171A21] border border-[#2A2E37]">
             <Sparkles className="h-5 w-5 text-indigo-500" />
           </div>
           <span className="font-bold text-lg text-white tracking-tight">Forge</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[400px] mt-12 lg:mt-0"
        >
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
              {mode === 'login' && 'Welcome back'}
              {mode === 'register' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {mode === 'login' && 'Enter your credentials to access your resumes.'}
              {mode === 'register' && 'Join thousands of professionals upgrading their careers.'}
              {mode === 'forgot' && 'We\'ll send a magic link to your email address.'}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden rounded-xl bg-rose-950/30 p-4 border border-rose-900/50 text-rose-300 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden rounded-xl bg-emerald-950/30 p-4 border border-emerald-900/50 text-emerald-300 text-sm font-medium"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Email address</span>
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2A2E37] bg-[#171A21] text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:bg-[#1a1e27] outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        clearMessages();
                      }}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2A2E37] bg-[#171A21] text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:bg-[#1a1e27] outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2A2E37] bg-[#171A21] text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:bg-[#1a1e27] outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 py-2.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-8 flex items-center">
             <div className="flex-1 border-t border-[#2A2E37]"></div>
             <div className="px-4 text-xs font-medium text-zinc-500 uppercase tracking-widest">or</div>
             <div className="flex-1 border-t border-[#2A2E37]"></div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#2A2E37] bg-[#171A21] hover:bg-[#1f232c] py-2.5 px-4 text-sm font-semibold text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.256-3.133C18.29 1.213 15.53 0 12.24 0 5.58 0 .24 5.34.24 12s5.34 12 12 12c6.953 0 11.583-4.892 11.583-11.792 0-.795-.084-1.4-.188-1.923H12.24Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mt-10 text-center">
            {mode === 'login' && (
              <p className="text-zinc-400 text-sm">
                Don't have an account?{' '}
                <button onClick={() => setMode('register')} className="font-medium text-white hover:text-indigo-400 transition-colors">Sign up</button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-zinc-400 text-sm">
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="font-medium text-white hover:text-indigo-400 transition-colors">Sign in</button>
              </p>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); clearMessages(); }} className="text-sm font-medium text-white hover:text-indigo-400 transition-colors">
                Return to login
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
