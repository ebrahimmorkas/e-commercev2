import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async ({ email, password }) => {
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  return <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />;
};

export default LoginPage;
