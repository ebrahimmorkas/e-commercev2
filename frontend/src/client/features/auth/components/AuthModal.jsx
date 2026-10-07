import { useEffect, useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import { useAuth } from '../hooks/useAuth';
import { getRegistrationConfig, getForgotPasswordConfig, requestPasswordResetOtp, resetPassword } from '../api/authApi';
import { useSignupLocations } from '../hooks/useSignupLocations';
import { useToast } from '../../../../components/common/Toast';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';
import htmLogo from '../../../../assets/htm_logo.jpeg';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';

const EyeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.7 10.7 0 0112 5c7 0 10.5 7 10.5 7a13.4 13.4 0 01-3.1 4.1M6.6 6.6C3.9 8.3 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 004.4-.9" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
  </svg>
);

const PasswordInput = ({ className, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon className="w-4.5 h-4.5" /> : <EyeIcon className="w-4.5 h-4.5" />}
      </button>
    </div>
  );
};

const EMPTY_REGISTER_FORM = {
  name: '',
  username: '',
  email: '',
  phone_no: '',
  whatsapp_no: '',
  password: '',
  country: '',
  state: '',
  city: '',
  isTaxRegistered: false,
  businessFullName: '',
  trn: '',
};

const EMPTY_RESET_FORM = { email: '', otp: '', newPassword: '', confirmPassword: '' };

// Same rule the backend enforces (forgotPasswordValidations.js).
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters with an uppercase letter, a lowercase letter and a number.';

const MODE_TITLES = {
  login: 'Sign in',
  register: 'Create your account',
  forgot: 'Forgot password',
  reset: 'Reset password',
};

/**
 * Login / Register modal for the storefront. Register calls POST
 * /api/auth/register then immediately logs in with the same credentials,
 * since the register response doesn't include a token (see authApi.js).
 *
 * country/state/city are dropdowns of the countries this store serves; the
 * account stores their ids, and login turns them into the Country/State/City
 * cookies that decide the shopper's currency, tax and shipping (backend
 * services/userLocationService.js + authController.setLocationCookies).
 *
 * Forgot password (only offered when the store has it on): the 'forgot' mode
 * asks for the account email and sends a code to it, the 'reset' mode takes
 * that code plus the new password, then returns to sign in.
 */
const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register } = useAuth();
  const toast = useToast();
  const { companySettings } = useStorefrontCompanySettings();
  const logoSrc = companySettings?.companyLogo?.url || htmLogo;
  const logoAlt = companySettings?.companyName || 'Sign in';
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);
  // Whether this vendor offers the optional "I am tax registered" checkbox (a Company
  // Settings choice). Off until the API says otherwise, and stays off if the call fails,
  // so a config hiccup can never block signup.
  const [taxRegistrationEnabled, setTaxRegistrationEnabled] = useState(false);
  // Whether this vendor lets customers sign up without a city ("Make City Optional" in
  // Company Settings). Required until the API says otherwise - the server enforces it anyway.
  const [cityOptional, setCityOptional] = useState(false);
  const locations = useSignupLocations(isOpen && mode === 'register', registerForm.country, registerForm.state);
  // Whether this store offers "Forgot password?". Null until the API says it does, and
  // stays null if the call fails, so the link is simply not shown.
  const [forgotPasswordConfig, setForgotPasswordConfig] = useState(null);
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM);
  const [notice, setNotice] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpLength = forgotPasswordConfig?.otpLength ?? 6;

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    getForgotPasswordConfig()
      .then((config) => {
        if (!cancelled) setForgotPasswordConfig(config?.forgotPasswordEnabled === true ? config : null);
      })
      .catch(() => {
        if (!cancelled) setForgotPasswordConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isOpen || mode !== 'register') return undefined;
    let cancelled = false;
    getRegistrationConfig()
      .then((config) => {
        if (cancelled) return;
        setTaxRegistrationEnabled(config?.taxRegistrationEnabled === true);
        setCityOptional(config?.cityOptional === true);
      })
      .catch(() => {
        if (cancelled) return;
        setTaxRegistrationEnabled(false);
        setCityOptional(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode]);

  const resetAndClose = () => {
    setError('');
    setNotice('');
    setLoading(false);
    setLoginForm({ identifier: '', password: '' });
    setRegisterForm(EMPTY_REGISTER_FORM);
    setResetForm(EMPTY_RESET_FORM);
    setMode(initialMode);
    onClose?.();
  };

  const switchMode = (nextMode) => {
    setError('');
    setNotice('');
    setMode(nextMode);
  };

  const openForgotPassword = () => {
    // Carries over what was typed in the sign-in box when it is an email.
    const typed = loginForm.identifier.trim();
    setResetForm({ ...EMPTY_RESET_FORM, email: typed.includes('@') ? typed : '' });
    switchMode('forgot');
  };

  const sendResetCode = async () => {
    const email = resetForm.email.trim();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const result = await requestPasswordResetOtp(email);
      setResendCooldown(result?.resendCooldownSeconds ?? forgotPasswordConfig?.resendCooldownSeconds ?? 60);
      setMode('reset');
      setNotice(`If an account exists for ${email}, a ${otpLength}-digit code has been sent to it.`);
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    sendResetCode();
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!PASSWORD_RULE.test(resetForm.newPassword)) {
      setError(PASSWORD_RULE_MESSAGE);
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ ...resetForm, email: resetForm.email.trim() });
      toast.success('Password reset - please sign in with your new password.');
      setLoginForm({ identifier: resetForm.email.trim(), password: '' });
      setResetForm(EMPTY_RESET_FORM);
      setMode('login');
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message || 'Could not reset the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Read straight from the DOM instead of trusting React state alone -
    // browser autofill sets the input's real value without always firing a
    // change event React's controlled state picks up in time, which made the
    // very first submit go out with stale (often empty) credentials.
    const form = e.target;
    const domIdentifier = form.elements.namedItem('identifier')?.value ?? loginForm.identifier;
    const domPassword = form.elements.namedItem('password')?.value ?? loginForm.password;
    setLoginForm({ identifier: domIdentifier, password: domPassword });
    setLoading(true);
    const result = await login(domIdentifier.trim(), domPassword);
    if (!result.success) {
      setLoading(false);
      setError(result.message);
      return;
    }
    // Admin accounts are redirected to /admin by the auth provider itself -
    // the page is already navigating away, so just wait rather than closing
    // the modal into a storefront view the user is about to leave.
    if (result.redirected) return;
    setLoading(false);
    toast.success('Welcome back!');
    resetAndClose();
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // whatsapp_no is optional on the backend (backend/models/User.js) but
    // Mongoose still runs minlength on an empty string, unlike an omitted
    // field - so drop it from the payload entirely when left blank.
    const registerPayload = { ...registerForm };
    if (!registerPayload.whatsapp_no.trim()) {
      delete registerPayload.whatsapp_no;
    }
    // City left empty (only possible when the vendor made it optional) is omitted too.
    if (!registerPayload.city) {
      delete registerPayload.city;
    }
    // Tax details only travel with a ticked box on a vendor that offers it; otherwise
    // the three keys are dropped so the payload is identical to a plain signup.
    if (taxRegistrationEnabled && registerPayload.isTaxRegistered) {
      registerPayload.businessFullName = registerPayload.businessFullName.trim();
      registerPayload.trn = registerPayload.trn.trim();
    } else {
      delete registerPayload.isTaxRegistered;
      delete registerPayload.businessFullName;
      delete registerPayload.trn;
    }
    const registerResult = await register(registerPayload);
    if (!registerResult.success) {
      setLoading(false);
      setError(registerResult.message);
      return;
    }

    const loginResult = await login(registerForm.email.trim(), registerForm.password);
    setLoading(false);
    if (!loginResult.success) {
      toast.success('Account created - please sign in.');
      switchMode('login');
      return;
    }
    toast.success('Account created - welcome!');
    resetAndClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={
        <span className="flex items-center gap-2.5">
          <img src={logoSrc} alt={logoAlt} className="h-8 w-auto object-contain" />
          {MODE_TITLES[mode]}
        </span>
      }
      size="sm"
    >
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}

      {notice && !error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700" role="status">
          {notice}
        </div>
      )}

      {mode === 'forgot' ? (
        <form onSubmit={handleForgotSubmit} className="space-y-3">
          <p className="text-sm text-slate-500">Enter your account email and we will send you a code to reset your password.</p>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={resetForm.email}
            onChange={(e) => setResetForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            required
            maxLength={254}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-60"
          >
            {loading ? 'Sending code...' : 'Send code'}
          </button>
          <p className="text-center text-sm text-slate-500">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
              disabled={loading}
            >
              Back to sign in
            </button>
          </p>
        </form>
      ) : mode === 'reset' ? (
        <form onSubmit={handleResetSubmit} className="space-y-3">
          <input
            type="text"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={`${otpLength}-digit code`}
            value={resetForm.otp}
            onChange={(e) => setResetForm((f) => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, otpLength) }))}
            className={inputClass}
            required
            minLength={otpLength}
            maxLength={otpLength}
            pattern={`\\d{${otpLength}}`}
            title={`Enter the ${otpLength}-digit code from your email`}
            disabled={loading}
          />
          <PasswordInput
            name="newPassword"
            autoComplete="new-password"
            placeholder="New password"
            value={resetForm.newPassword}
            onChange={(e) => setResetForm((f) => ({ ...f, newPassword: e.target.value }))}
            className={inputClass}
            required
            minLength={8}
            maxLength={128}
            disabled={loading}
          />
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={resetForm.confirmPassword}
            onChange={(e) => setResetForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            className={inputClass}
            required
            maxLength={128}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
              disabled={loading}
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={sendResetCode}
              className="font-semibold text-amber-600 hover:text-amber-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      ) : mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <input
            type="text"
            name="identifier"
            placeholder="Username, email, or phone"
            value={loginForm.identifier}
            onChange={(e) => setLoginForm((f) => ({ ...f, identifier: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          <PasswordInput
            name="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          {forgotPasswordConfig && (
            <div className="text-right">
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-sm font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
              disabled={loading}
            >
              Create account
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            value={registerForm.name}
            onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
            required
            minLength={2}
            maxLength={50}
            disabled={loading}
          />
          <input
            type="text"
            placeholder="Username"
            value={registerForm.username}
            onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          <input
            type="email"
            placeholder="Email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={registerForm.phone_no}
            onChange={(e) => setRegisterForm((f) => ({ ...f, phone_no: e.target.value }))}
            className={inputClass}
            required
            minLength={10}
            maxLength={14}
            pattern="\+?[0-9]{10,14}"
            title="10 to 14 digits, with an optional leading +"
            disabled={loading}
          />
          <input
            type="tel"
            placeholder="WhatsApp number (optional)"
            value={registerForm.whatsapp_no}
            onChange={(e) => setRegisterForm((f) => ({ ...f, whatsapp_no: e.target.value }))}
            className={inputClass}
            minLength={10}
            maxLength={14}
            disabled={loading}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              aria-label="Country"
              value={registerForm.country}
              // A new country invalidates the state and city chosen under the old one.
              onChange={(e) => setRegisterForm((f) => ({ ...f, country: e.target.value, state: '', city: '' }))}
              className={`${inputClass} bg-white`}
              required
              disabled={loading || locations.loading}
            >
              <option value="">{locations.loading ? 'Loading...' : 'Country'}</option>
              {locations.countryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label="State"
              value={registerForm.state}
              onChange={(e) => setRegisterForm((f) => ({ ...f, state: e.target.value, city: '' }))}
              className={`${inputClass} bg-white`}
              required
              disabled={loading || !registerForm.country}
            >
              <option value="">State</option>
              {locations.stateOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {/* Hidden when the vendor made the city optional (Company Settings). */}
            {!cityOptional && (
              <select
                aria-label="City"
                value={registerForm.city}
                onChange={(e) => setRegisterForm((f) => ({ ...f, city: e.target.value }))}
                className={`${inputClass} bg-white`}
                required
                disabled={loading || !registerForm.state}
              >
                <option value="">City</option>
                {locations.cityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </div>
          {taxRegistrationEnabled && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={registerForm.isTaxRegistered}
                  onChange={(e) =>
                    setRegisterForm((f) => ({
                      ...f,
                      isTaxRegistered: e.target.checked,
                      // Unticking drops what was typed, so it can't be resubmitted later by accident.
                      ...(e.target.checked ? {} : { businessFullName: '', trn: '' }),
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-amber-600 cursor-pointer"
                  disabled={loading}
                />
                I am tax registered
              </label>
              {registerForm.isTaxRegistered && (
                <>
                  <input
                    type="text"
                    placeholder="Business full name"
                    value={registerForm.businessFullName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, businessFullName: e.target.value }))}
                    className={inputClass}
                    required
                    maxLength={100}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="TRN (15 digits)"
                    value={registerForm.trn}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, trn: e.target.value.replace(/\D/g, '') }))}
                    className={inputClass}
                    required
                    minLength={15}
                    maxLength={15}
                    pattern="\d{15}"
                    title="TRN must be exactly 15 digits"
                    disabled={loading}
                  />
                </>
              )}
            </div>
          )}
          <PasswordInput
            placeholder="Password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
              disabled={loading}
            >
              Sign in
            </button>
          </p>
        </form>
      )}
    </Modal>
  );
};

export default AuthModal;
