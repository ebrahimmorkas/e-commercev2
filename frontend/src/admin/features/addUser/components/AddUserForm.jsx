import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

// Mirrors backend/middlewares/validations/userValidations.js's
// USERNAME_PATTERN/PHONE_PATTERN/PASSWORD_PATTERN so the form rejects the
// same input the API would reject, before a round-trip.
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const validationSchema = {
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
  password: {
    required: true,
    validations: [
      (v) => (v.length >= 8 ? true : 'Password must be at least 8 characters'),
      (v) => (v.length <= 128 ? true : 'Password must not exceed 128 characters'),
      (v) => (PASSWORD_PATTERN.test(v) ? true : 'Password must contain at least one uppercase letter, one lowercase letter and one number'),
    ],
  },
  // The selected CountryMaster/StateMaster/CityMaster ids - saved as-is on
  // User.country/state/city (same as self-registration's dropdowns).
  country: { required: true },
  state: { required: true },
  city: { required: true },
};

const EMPTY_VALUES = {
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
 * The admin-side equivalent of customer self-registration - same required
 * fields as authService.registerUser, entered by the admin instead. role
 * always defaults to "user" server-side, so it isn't collected here.
 *
 * @param {Object} props.lookups - from useAddUserLookups: { countryOptions, getStateOptions, getCityOptions }
 * @param {(values: Object) => Promise<boolean>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const AddUserForm = ({ lookups, onSubmit, onCancel, submitting = false }) => {
  const { countryOptions, getStateOptions, getCityOptions } = lookups;

  const handleFormSubmit = async (values) => {
    const payload = {
      name: values.name.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phone_no: values.phone_no.trim(),
      password: values.password,
      // The picked location ids - the backend validates the chain and they
      // become the customer's Country/State/City cookies (currency, tax, shipping).
      country: values.country,
      state: values.state,
      city: values.city,
    };
    if (values.whatsapp_no?.trim()) payload.whatsapp_no = values.whatsapp_no.trim();

    await onSubmit(payload);
  };

  return (
    <Form initialValues={EMPTY_VALUES} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];

        const handleCountryChange = (value) => {
          setFieldValue('country', value);
          setFieldValue('state', '');
          setFieldValue('city', '');
        };
        const handleStateChange = (value) => {
          setFieldValue('state', value);
          setFieldValue('city', '');
        };

        const stateOptions = getStateOptions(values.country);
        const cityOptions = getCityOptions(values.country, values.state);

        return (
          <>
            <div>
              <InputField
                label="Name"
                name="name"
                placeholder="Full name"
                value={values.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                required
                maxLength={50}
                showError={false}
              />
              {showError('name') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.name}</p>}
            </div>

            <div>
              <InputField
                label="Username"
                name="username"
                placeholder="e.g. jane.doe"
                value={values.username}
                onChange={handleChange('username')}
                onBlur={handleBlur('username')}
                required
                maxLength={30}
                showError={false}
              />
              {showError('username') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.username}</p>}
            </div>

            <div>
              <InputField
                label="Email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={values.email}
                onChange={handleChange('email')}
                onBlur={handleBlur('email')}
                required
                showError={false}
              />
              {showError('email') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <InputField
                  label="Phone Number"
                  name="phone_no"
                  type="tel"
                  placeholder="e.g. +919876543210"
                  value={values.phone_no}
                  onChange={handleChange('phone_no')}
                  onBlur={handleBlur('phone_no')}
                  required
                  maxLength={14}
                  showError={false}
                />
                {showError('phone_no') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.phone_no}</p>}
              </div>
              <div>
                <InputField
                  label="WhatsApp Number"
                  name="whatsapp_no"
                  type="tel"
                  placeholder="Optional, if different from phone"
                  value={values.whatsapp_no}
                  onChange={handleChange('whatsapp_no')}
                  onBlur={handleBlur('whatsapp_no')}
                  maxLength={14}
                  showError={false}
                />
                {showError('whatsapp_no') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.whatsapp_no}</p>}
              </div>
            </div>

            <div>
              <InputField
                label="Password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={values.password}
                onChange={handleChange('password')}
                onBlur={handleBlur('password')}
                required
                maxLength={128}
                showError={false}
              />
              {showError('password') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.password}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Dropdown
                label="Country"
                name="country"
                placeholder={countryOptions.length ? 'Select a country' : 'No countries allowed for your account'}
                options={countryOptions}
                value={values.country}
                onChange={handleCountryChange}
                required
                searchable
                error={showError('country') ? errors.country : ''}
              />
              <Dropdown
                label="State"
                name="state"
                placeholder={values.country ? 'Select a state' : 'Select a country first'}
                options={stateOptions}
                value={values.state}
                onChange={handleStateChange}
                disabled={!values.country}
                required
                searchable
                error={showError('state') ? errors.state : ''}
              />
              <Dropdown
                label="City"
                name="city"
                placeholder={values.state ? 'Select a city' : 'Select a state first'}
                options={cityOptions}
                value={values.city}
                onChange={(value) => setFieldValue('city', value)}
                disabled={!values.state}
                required
                searchable
                error={showError('city') ? errors.city : ''}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                Add User
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default AddUserForm;
