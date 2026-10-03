import { useEffect, useState } from 'react';
import InputField from '../../../../components/common/InputField/InputField';
import Button from '../../../../components/common/Buttons/Button';
import { validations, required } from '../../../../utils/index';
import { requestPasswordResetOtp, resetPassword } from '../api/authApi';
import theme from '../theme/theme';

const emailValidations = [required('Email is required'), validations.email];
const passwordValidations = [required('New password is required'), validations.mediumPassword];

// First failing rule's message, or '' when the value passes them all.
const firstError = (value, rules) => {
  for (const rule of rules) {
    const result = rule(value);
    if (result !== true) return result;
  }
  return '';
};

// The backend's validation errors ([{ field, message }]) keyed by field.
const toFieldErrors = (errors) =>
  Array.isArray(errors) ? Object.fromEntries(errors.map((e) => [e.field, e.message])) : {};

/**
 * Forgot password, shown in place of LoginForm: step 1 asks for the account
 * email and sends a code to it, step 2 takes that code plus the new password.
 *
 * @param {Object} props - Component properties
 * @param {Function} props.onBack - Called when "Back to sign in" is clicked
 * @param {Function} props.onDone - Called with the success message once the password is reset
 * @param {number} props.otpLength - Number of digits in the emailed code
 * @param {number} props.resendCooldownSeconds - Wait before another code can be requested
 * @param {string} props.className - Additional CSS classes for the wrapping card
 */
const ForgotPasswordForm = ({ onBack, onDone, otpLength = 6, resendCooldownSeconds = 60, className = '' }) => {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    const emailError = firstError(email, emailValidations);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      const result = await requestPasswordResetOtp(email.trim());
      setCooldown(result?.resendCooldownSeconds ?? resendCooldownSeconds);
      setNotice(`If an account exists for ${email.trim()}, a ${otpLength}-digit code has been sent to it.`);
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Could not send the code. Please try again.');
      setFieldErrors(toFieldErrors(err.errors));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const errors = {
      otp: new RegExp(`^\\d{${otpLength}}$`).test(otp) ? '' : `Enter the ${otpLength}-digit code`,
      newPassword: firstError(newPassword, passwordValidations),
      confirmPassword: confirmPassword === newPassword ? '' : 'Passwords do not match',
    };
    if (errors.otp || errors.newPassword || errors.confirmPassword) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      await resetPassword({ email: email.trim(), otp, newPassword, confirmPassword });
      onDone?.('Password reset successfully. Please sign in with your new password.');
    } catch (err) {
      setError(err.message || 'Could not reset the password. Please try again.');
      setFieldErrors(toFieldErrors(err.errors));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`w-full min-h-screen flex items-center justify-center ${theme.page.background} px-4`}
    >
      <div
        className={`relative w-full max-w-sm ${theme.card.background} rounded-xl shadow-md p-8 pt-19 ${className}`}
      >
        <img
          src={theme.logo.src}
          alt={theme.logo.alt}
          className={`${theme.logo.className} absolute -top-[70px] left-1/2 -translate-x-1/2 z-10`}
        />

        <div className="mb-6 text-center">
          <h1 className={`text-2xl font-semibold ${theme.text.heading}`}>
            {step === 'email' ? 'Forgot password' : 'Reset password'}
          </h1>
          <p className={`mt-1 text-sm ${theme.text.subheading}`}>
            {step === 'email'
              ? 'Enter your email and we will send you a code'
              : 'Enter the code from your email and a new password'}
          </p>
        </div>

        {error && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${theme.alert.error.background} border ${theme.alert.error.border} ${theme.alert.error.text}`}
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && !error && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${theme.alert.success.background} border ${theme.alert.success.border} ${theme.alert.success.text}`}
            role="status"
          >
            {notice}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="mb-6">
              <InputField
                type="email"
                name="email"
                id="forgot-email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                validations={emailValidations}
                error={fieldErrors.email}
                required
                disabled={loading}
                className="w-full mb-2"
              />
            </div>

            <Button type="submit" variant="primary" size="md" fullWidth loading={loading} loadingText="Sending code...">
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} noValidate>
            <div className="mb-4">
              <InputField
                type="text"
                name="otp"
                id="forgot-otp"
                placeholder={`${otpLength}-digit code`}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, otpLength))}
                error={fieldErrors.otp}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={loading}
                className="w-full mb-2"
              />
            </div>

            <div className="mb-4">
              <InputField
                type="password"
                name="newPassword"
                id="forgot-new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                validations={passwordValidations}
                error={fieldErrors.newPassword}
                maxLength={128}
                autoComplete="new-password"
                disabled={loading}
                className="w-full mb-2"
              />
            </div>

            <div className="mb-2">
              <InputField
                type="password"
                name="confirmPassword"
                id="forgot-confirm-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirmPassword}
                maxLength={128}
                autoComplete="new-password"
                disabled={loading}
                className="w-full mb-2"
              />
            </div>

            <div className="flex items-center justify-end mb-6">
              <button
                type="button"
                onClick={sendCode}
                disabled={loading || cooldown > 0}
                className={`text-sm font-medium ${theme.link.default} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>

            <Button type="submit" variant="primary" size="md" fullWidth loading={loading} loadingText="Resetting...">
              Reset password
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className={`text-sm font-medium ${theme.link.default}`}
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
