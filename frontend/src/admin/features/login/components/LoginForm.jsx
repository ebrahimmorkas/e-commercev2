import { useState } from 'react';
import InputField from '../../../../components/common/InputField/InputField';
import Button from '../../../../components/common/Buttons/Button';
import { validations, required } from '../../../../utils/index';
import theme from '../theme/theme';

/**

 *
 * @param {Object} props - Component properties
 * @param {Function} props.onSubmit - Called with { email, password, rememberMe } when the form is submitted and valid
 * @param {boolean} props.loading - Show loading state on the submit button
 * @param {string} props.error - Top-level error message (e.g. "Invalid email or password")
 * @param {Function} props.onForgotPassword - Called when "Forgot password?" is clicked
 * @param {string} props.className - Additional CSS classes for the wrapping card
 */
const LoginForm = ({
  onSubmit,
  loading = false,
  error = '',
  onForgotPassword,
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailValidations = [required('Email is required'), validations.email];


  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ email, password });
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
            Welcome back
          </h1>
          <p className={`mt-1 text-sm ${theme.text.subheading}`}>
            Sign in to continue to your account
          </p>
        </div>

        {/* Top-level error */}
        {error && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${theme.alert.error.background} border ${theme.alert.error.border} ${theme.alert.error.text}`}
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <InputField
              type="email"
              name="email"
              id="login-email"
              // label="Email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              validations={emailValidations}
              required
              disabled={loading}
              className="w-full mb-2"
            />
          </div>

          <div className="mb-2">
            <InputField
              type="password"
              name="password"
              id="login-password"
              // label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // validations={passwordValidations}
              required = {false}
              disabled={loading}
              className="w-full  mb-2"
              
            />
          </div>

          <div className="flex items-center justify-between mb-6">
            {/* <label className={`flex items-center text-sm ${theme.text.body} cursor-pointer select-none`}>
              <input
                type="checkbox"
                className={`mr-2 h-4 w-4 rounded ${theme.checkbox.default}`}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              Remember me
            </label> */}

            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className={`text-sm font-medium ${theme.link.default}`}
              >
                Forgot password?
              </button>
            )}
          </div>

          <Button
            type="submit"
            variant={'primary'}
            size="md"
            fullWidth
            loading={loading}
            loadingText="Signing in..."
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;