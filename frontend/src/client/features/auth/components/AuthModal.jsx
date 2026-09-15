import { useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../../../../components/common/Toast';
import htmLogo from '../../../../assets/htm_logo.jpeg';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';

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
};

/**
 * Login / Register modal for the storefront. Register calls POST
 * /api/auth/register then immediately logs in with the same credentials,
 * since the register response doesn't include a token (see authApi.js).
 *
 * country/state/city are plain free-text fields here (not the
 * country_id/state_id/city_id ObjectId refs the address book uses) -
 * backend/models/User.js stores them as unvalidated strings, unlike
 * Address's real CountryMaster/StateMaster/CityMaster foreign keys.
 */
const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);

  const resetAndClose = () => {
    setError('');
    setLoading(false);
    setLoginForm({ identifier: '', password: '' });
    setRegisterForm(EMPTY_REGISTER_FORM);
    setMode(initialMode);
    onClose?.();
  };

  const switchMode = (nextMode) => {
    setError('');
    setMode(nextMode);
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
          <img src={htmLogo} alt="HTM" className="h-8 w-auto object-contain" />
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </span>
      }
      size="sm"
    >
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}

      {mode === 'login' ? (
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
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
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
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Country"
              value={registerForm.country}
              onChange={(e) => setRegisterForm((f) => ({ ...f, country: e.target.value }))}
              className={inputClass}
              required
              disabled={loading}
            />
            <input
              type="text"
              placeholder="State"
              value={registerForm.state}
              onChange={(e) => setRegisterForm((f) => ({ ...f, state: e.target.value }))}
              className={inputClass}
              required
              disabled={loading}
            />
            <input
              type="text"
              placeholder="City"
              value={registerForm.city}
              onChange={(e) => setRegisterForm((f) => ({ ...f, city: e.target.value }))}
              className={inputClass}
              required
              disabled={loading}
            />
          </div>
          <input
            type="password"
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
