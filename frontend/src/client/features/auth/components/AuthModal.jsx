import { useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../../../../components/common/Toast';

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
    setLoading(true);
    const result = await login(loginForm.identifier.trim(), loginForm.password);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    toast.success('Welcome back!');
    resetAndClose();
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const registerResult = await register(registerForm);
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
      title={mode === 'login' ? 'Sign in' : 'Create your account'}
      size="sm"
    >
      <div className="flex gap-2 mb-4 text-sm font-medium">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150 ${
            mode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150 ${
            mode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Create account
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username, email, or phone"
            value={loginForm.identifier}
            onChange={(e) => setLoginForm((f) => ({ ...f, identifier: e.target.value }))}
            className={inputClass}
            required
            disabled={loading}
          />
          <input
            type="password"
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
        </form>
      )}
    </Modal>
  );
};

export default AuthModal;
