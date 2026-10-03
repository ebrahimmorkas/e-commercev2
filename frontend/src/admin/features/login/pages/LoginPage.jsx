import { useEffect, useState } from 'react';
import LoginForm from '../components/LoginForm';
import ForgotPasswordForm from '../components/ForgotPasswordForm';
import { useAuth } from '../hooks/useAuth';
import { getForgotPasswordConfig } from '../api/authApi';
import { useToast } from '../../../../components/common/Toast';

const LoginPage = () => {
  const { login } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('login');
  // Whether this store offers "Forgot password?". Null until the API says it
  // does, and stays null if the call fails, so the link is simply not shown.
  const [forgotPasswordConfig, setForgotPasswordConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getForgotPasswordConfig()
      .then((config) => {
        if (!cancelled && config?.forgotPasswordEnabled === true) setForgotPasswordConfig(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async ({ email, password }) => {
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  if (view === 'forgot' && forgotPasswordConfig) {
    return (
      <ForgotPasswordForm
        otpLength={forgotPasswordConfig.otpLength}
        resendCooldownSeconds={forgotPasswordConfig.resendCooldownSeconds}
        onBack={() => setView('login')}
        onDone={(message) => {
          toast.success(message);
          setError('');
          setView('login');
        }}
      />
    );
  }

  return (
    <LoginForm
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      onForgotPassword={forgotPasswordConfig ? () => setView('forgot') : undefined}
    />
  );
};

export default LoginPage;
