import { useState } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import theme from '../../customers/theme/theme';
import { useIsCityOptional } from '../../companySettings/hooks/useIsCityOptional';

// Mirrors backend/middlewares/validations/deliveryAgentValidations.js so the
// form rejects the same input the API would.
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const buildValidationSchema = (isCreate) => ({
  name: {
    required: true,
    validations: [
      (v) => (v.trim().length >= 2 ? true : 'Name must be at least 2 characters'),
      (v) => (v.trim().length <= 50 ? true : 'Name must not exceed 50 characters'),
    ],
  },
  username: {
    required: true,
    validations: [
      (v) => (v.trim().length >= 3 ? true : 'Username must be at least 3 characters'),
      (v) => (v.trim().length <= 30 ? true : 'Username must not exceed 30 characters'),
      (v) => (USERNAME_PATTERN.test(v.trim().toLowerCase()) ? true : 'Username may only contain lowercase letters, numbers, dots and underscores'),
    ],
  },
  email: {
    required: true,
    validations: [(v) => (EMAIL_PATTERN.test(v.trim()) ? true : 'Enter a valid email address')],
  },
  phone_no: {
    required: true,
    validations: [(v) => (PHONE_PATTERN.test(v.trim()) ? true : 'Enter a valid phone number (10-14 digits, optional leading +)')],
  },
  whatsapp_no: {
    required: false,
    validations: [(v) => (!v.trim() || PHONE_PATTERN.test(v.trim()) ? true : 'Enter a valid WhatsApp number (10-14 digits, optional leading +)')],
  },
  ...(isCreate
    ? {
        password: {
          required: true,
          validations: [
            (v) => (v.length >= 8 ? true : 'Password must be at least 8 characters'),
            (v) => (v.length <= 128 ? true : 'Password must not exceed 128 characters'),
            (v) => (PASSWORD_PATTERN.test(v) ? true : 'Password must contain at least one uppercase letter, one lowercase letter and one number'),
          ],
        },
      }
    : {}),
});

/**
 * Create / edit a delivery agent. Country, state and city are optional for an
 * agent, but go together: all three or none.
 *
 * @param {'create'|'edit'} props.mode
 * @param {Object} [props.initialValues] - the agent being edited (country/state/city are location ids)
 * @param {Object} props.lookups - from useCustomerLookups: { countryOptions, getStateOptions, getCityOptions }
 * @param {(payload: Object) => Promise<boolean>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const DeliveryAgentForm = ({ mode, initialValues = {}, lookups, onSubmit, onCancel, submitting = false }) => {
  const isCreate = mode === 'create';
  const validationSchema = buildValidationSchema(isCreate);
  const { countryOptions, getStateOptions, getCityOptions } = lookups;
  const [locationError, setLocationError] = useState('');
  // The vendor's "Make City Optional" choice (Company Settings): country + state alone is then enough.
  const cityOptional = useIsCityOptional();

  const formInitialValues = {
    name: initialValues.name || '',
    username: initialValues.username || '',
    email: initialValues.email || '',
    phone_no: initialValues.phone_no || '',
    whatsapp_no: initialValues.whatsapp_no || '',
    password: '',
    country: initialValues.country || '',
    state: initialValues.state || '',
    city: initialValues.city || '',
  };

  const handleFormSubmit = async (values) => {
    const picked = [values.country, values.state, values.city].filter(Boolean).length;
    const complete = picked === 3 || (cityOptional && values.country && values.state);
    if (picked !== 0 && !complete) {
      setLocationError(cityOptional
        ? 'Choose a country and state together (city is optional), or leave them all empty.'
        : 'Choose a country, state and city together, or leave all three empty.');
      return;
    }
    setLocationError('');

    const payload = {
      name: values.name.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phone_no: values.phone_no.trim(),
      whatsapp_no: values.whatsapp_no.trim(),
      country: values.country || '',
      state: values.state || '',
      city: values.city || '',
    };
    if (isCreate) payload.password = values.password;

    await onSubmit(payload);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];
        const fieldError = (name) => showError(name) && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors[name]}</p>;

        return (
          <>
            <div>
              <InputField label="Name" name="name" placeholder="Full name" value={values.name} onChange={handleChange('name')} onBlur={handleBlur('name')} required maxLength={50} showError={false} />
              {fieldError('name')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <InputField label="Username" name="username" placeholder="Used to log in, e.g. ravi.agent" value={values.username} onChange={handleChange('username')} onBlur={handleBlur('username')} required maxLength={30} showError={false} />
                {fieldError('username')}
              </div>
              <div>
                <InputField label="Email" name="email" type="email" placeholder="name@example.com" value={values.email} onChange={handleChange('email')} onBlur={handleBlur('email')} required showError={false} />
                {fieldError('email')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <InputField label="Phone Number" name="phone_no" type="tel" placeholder="e.g. +971501234567" value={values.phone_no} onChange={handleChange('phone_no')} onBlur={handleBlur('phone_no')} required maxLength={14} showError={false} />
                {fieldError('phone_no')}
              </div>
              <div>
                <InputField label="WhatsApp Number" name="whatsapp_no" type="tel" placeholder="Optional" value={values.whatsapp_no} onChange={handleChange('whatsapp_no')} onBlur={handleBlur('whatsapp_no')} maxLength={14} showError={false} />
                {fieldError('whatsapp_no')}
              </div>
            </div>

            {isCreate && (
              <div>
                <InputField label="Password" name="password" type="password" placeholder="At least 8 characters" value={values.password} onChange={handleChange('password')} onBlur={handleBlur('password')} required showError={false} />
                {fieldError('password')}
                <p className={`mt-1 text-xs ${theme.text.muted}`}>The agent logs in to /admin with this username and password.</p>
              </div>
            )}

            <div>
              <p className={`text-sm font-medium ${theme.text.heading} mb-2`}>
                Location <span className={`font-normal ${theme.text.muted}`}>(optional)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Dropdown
                  label="Country"
                  name="country"
                  placeholder="Select a country"
                  options={countryOptions}
                  value={values.country}
                  onChange={(value) => {
                    setFieldValue('country', value || '');
                    setFieldValue('state', '');
                    setFieldValue('city', '');
                  }}
                  searchable
                  clearable
                />
                <Dropdown
                  label="State"
                  name="state"
                  placeholder={values.country ? 'Select a state' : 'Select a country first'}
                  options={getStateOptions(values.country)}
                  value={values.state}
                  onChange={(value) => {
                    setFieldValue('state', value || '');
                    setFieldValue('city', '');
                  }}
                  disabled={!values.country}
                  searchable
                  clearable
                />
                <Dropdown
                  label="City"
                  name="city"
                  placeholder={values.state ? 'Select a city' : 'Select a state first'}
                  options={getCityOptions(values.country, values.state)}
                  value={values.city}
                  onChange={(value) => setFieldValue('city', value || '')}
                  disabled={!values.state}
                  searchable
                  clearable
                />
              </div>
              {locationError && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{locationError}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {isCreate ? 'Create Agent' : 'Save Changes'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default DeliveryAgentForm;
