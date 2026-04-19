import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Github, Mail, UserCircle, UserPlus, ArrowRight, Eye, EyeOff, Check, X, Smartphone, Hash } from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithGithub, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  auth
} from '../firebase';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const validatePassword = (pass: string) => {
    return {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      symbol: /[!@#$%^&*(),.?":{}|<>]/.test(pass),
    };
  };

  const passwordStatus = validatePassword(password);
  const isPasswordStrong = Object.values(passwordStatus).every(Boolean);

  const getFriendlyErrorMessage = (error: any) => {
    const code = error.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try signing in instead!';
      case 'auth/admin-restricted-operation':
        return 'This sign-in method is disabled. Please enable it in the Firebase Console.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled. Please try again.';
      case 'auth/popup-blocked':
        return 'The sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for sign-in. Please add this URL to the "Authorized domains" list in the Firebase Console.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/operation-not-allowed':
        if (error.message?.includes('SMS unable to be sent until this region enabled')) {
          return 'SMS is disabled for your region. Please enable it in the Firebase Console (Authentication > Settings > SMS Region Policy).';
        }
        return 'This sign-in method is not enabled in Firebase.';
      case 'auth/billing-not-enabled':
        return 'Phone authentication requires a paid (Blaze) plan in this region. Please upgrade your Firebase project or use a Test Phone Number.';
      case 'auth/captcha-check-failed':
        return 'reCAPTCHA verification failed. Please try again.';
      case 'auth/invalid-phone-number':
        return 'The phone number provided is invalid. Please use E.164 format (e.g., +1234567890).';
      case 'auth/too-many-requests':
        return 'Too many requests. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Auth Error:", error);
        setError(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGithub();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Auth Error:", error);
        setError(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && !isPasswordStrong) {
      setError('Please meet all password requirements before creating an account.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Auth Error:", error);
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      console.error("Auth Error:", error);
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const setupRecaptcha = () => {
    const container = document.getElementById('recaptcha-container');
    if (!container) return;

    // If a verifier already exists and is attached to this container, don't re-render
    if ((window as any).recaptchaVerifier) {
      return;
    }

    try {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {},
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.');
          if ((window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier.clear();
            (window as any).recaptchaVerifier = null;
          }
        }
      });
    } catch (error: any) {
      console.error("reCAPTCHA Setup Error:", error);
      if (error.message?.includes('already been rendered')) {
        // If it's already there, we're actually fine to proceed
        return;
      }
      setError('Failed to initialize security check. Please refresh the page.');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.startsWith('+')) {
      setError('Please include country code (e.g., +1 for USA, +91 for India)');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      (window as any).confirmationResult = confirmationResult;
      setVerificationId(confirmationResult.verificationId);
      setMessage('OTP sent! Check your phone.');
    } catch (error: any) {
      console.error("Phone Auth Error:", error);
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const confirmationResult = (window as any).confirmationResult;
      await confirmationResult.confirm(verificationCode);
    } catch (error: any) {
      console.error("OTP Verification Error:", error);
      setError('Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center"
      >
        <div className="mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-600/20">
            <span className="text-3xl font-black text-white italic">B</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">BITEWISE</h1>
          <p className="text-zinc-400 text-sm">Fuel your college life with AI precision.</p>
        </div>

        <div className="space-y-4">
          <div className="flex bg-zinc-800 p-1 rounded-2xl mb-6">
            <button
              onClick={() => { setLoginMethod('email'); setError(null); setMessage(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${loginMethod === 'email' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Email
            </button>
            <button
              onClick={() => { setLoginMethod('phone'); setError(null); setMessage(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${loginMethod === 'phone' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Phone
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-2 px-4 rounded-xl mb-4">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs py-2 px-4 rounded-xl mb-4">
              {message}
            </div>
          )}

          {loginMethod === 'email' ? (
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                />
              </div>
              
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-12 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isSignUp && (
                <div className="bg-zinc-800/50 border border-zinc-800 p-4 rounded-2xl space-y-2 text-left">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Password Requirements</p>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 text-xs ${passwordStatus.length ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      {passwordStatus.length ? <Check size={12} /> : <X size={12} />}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordStatus.uppercase ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      {passwordStatus.uppercase ? <Check size={12} /> : <X size={12} />}
                      <span>At least one capital letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordStatus.symbol ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      {passwordStatus.symbol ? <Check size={12} /> : <X size={12} />}
                      <span>At least one symbol (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>
              )}
              
              {!isSignUp && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-bold text-zinc-500 hover:text-red-500 uppercase tracking-widest transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || (isSignUp && !isPasswordStrong)}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-2xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSignUp ? <UserPlus size={18} /> : <ArrowRight size={18} />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={verificationId ? handleVerifyOtp : handleSendOtp} className="space-y-3">
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="tel"
                  required
                  disabled={!!verificationId}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all disabled:opacity-50"
                />
              </div>

              {verificationId && (
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="text"
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
              )}

              <div id="recaptcha-container"></div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-2xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowRight size={18} />
                    {verificationId ? 'Verify OTP' : 'Send OTP'}
                  </>
                )}
              </button>

              {verificationId && (
                <button
                  type="button"
                  onClick={() => { setVerificationId(null); setVerificationCode(''); setMessage(null); }}
                  className="w-full text-xs text-zinc-500 hover:text-white transition-colors py-2"
                >
                  Change Phone Number
                </button>
              )}
            </form>
          )}

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
              <span className="bg-zinc-900 px-2 text-zinc-600">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 text-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              Google
            </button>
            <button
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-zinc-800 text-white font-bold py-3 rounded-2xl hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50 text-sm border border-zinc-700"
            >
              <Github size={18} />
              GitHub
            </button>
          </div>

          <button
            onClick={handleAnonymousSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-zinc-400 font-bold py-3 rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 text-sm border border-zinc-800"
          >
            <UserCircle size={18} />
            Continue as Guest
          </button>

          <p className="text-xs text-zinc-500 px-4">
            By continuing, you agree to track your calories and stay healthy. No cap.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
