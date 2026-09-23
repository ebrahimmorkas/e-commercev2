import { useMemo } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

// Mirrors backend/middlewares/validations/userValidations.js's
// USERNAME_PATTERN/PHONE_PATTERN so the form rejects the same input the API
// would reject, before a round-trip.
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildValidationSchema = () => ({
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
  // The selected CountryMaster/StateMaster/CityMaster ids - saved as-is on
  // User.country/state/city (same as self-registration's dropdowns).
  country: { required: true },
  state: { required: true },
  city: { required: true },
});

const findOptionByLabel = (options, label) =>
  options.find((o) => o.label.trim().toLowerCase() === (label || '').trim().toLowerCase());

// The customer's saved location is an id (matching the dropdown values); an
// account from before that change still holds a typed name, matched by label.
const findOption = (options, saved) => options.find((o) => o.value === saved) || findOptionByLabel(options, saved);

/**
 * Edit form for an existing customer - name/username/email/phone/whatsapp/
 * country/state/city, matching backend/middlewares/validations/userValidations.js's
 * updateUserAdminSchema fields. There is no "add" mode here - creating a
 * customer is the separate Add User module (admin/features/addUser).
 *
 * @param {Object} props.initialValues - country/state/city are plain name
 * strings as stored on the User doc; resolved to their matching
 * CountryMaster/StateMaster/CityMaster _id below so the dropdowns can
 * preselect them. A name that doesn't match any current allowed
 * country/state/city (stale data, or no longer in CompanyMaster.allowedCountries)
 * is left unresolved and must be explicitly reselected.
 * @param {Object} props.lookups - from useCustomerLookups: { countryOptions, getStateOptions, getCityOptions }
 * @param {(values: Object) => Promise<boolean>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const CustomerForm = ({ initialValues = {}, lookups, onSubmit, onCancel, submitting = false }) => {
  const validationSchema = buildValidationSchema();
  const { countryOptions, getStateOptions, getCityOptions } = lookups;

  const resolved = useMemo(() => {
    const countryOption = findOption(countryOptions, initialValues.country);
    const countryId = countryOption?.value || '';
    const stateOption = countryId ? findOption(getStateOptions(countryId), initialValues.state) : null;
    const stateId = stateOption?.value || '';
    const cityOption = stateId ? findOption(getCityOptions(countryId, stateId), initialValues.city) : null;
    const cityId = cityOption?.value || '';
    return { countryId, stateId, cityId };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formInitialValues = {
    name: initialValues.name || '',
    username: initialValues.username || '',
    email: initialValues.email || '',
    phone_no: initialValues.phone_no || '',
    whatsapp_no: initialValues.whatsapp_no || '',
    country: resolved.countryId,
    state: resolved.stateId,
    city: resolved.cityId,
  };

  const handleFormSubmit = async (values) => {
    // The picked location ids are saved as-is (backend validates the
    // country -> state -> city chain and turns them into the customer's
    // Country/State/City cookies for currency, tax and shipping).
    const payload = {
      name: values.name.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phone_no: values.phone_no.trim(),
      country: values.country,
      state: values.state,
      city: values.city,
    };
    if (values.whatsapp_no?.trim()) payload.whatsapp_no = values.whatsapp_no.trim();

    await onSubmit(payload);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
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
                helperText={!values.country && initialValues.country ? `Currently saved as "${initialValues.country}" - reselect to keep it.` : ''}
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
                helperText={
                  !values.state && !showError('state') && initialValues.state && values.country === resolved.countryId
                    ? `Currently saved as "${initialValues.state}" - reselect to keep it.`
                    : ''
                }
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
                helperText={
                  !values.city && !showError('city') && initialValues.city
                    && values.country === resolved.countryId && values.state === resolved.stateId
                    ? `Currently saved as "${initialValues.city}" - reselect to keep it.`
                    : ''
                }
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                Save Changes
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default CustomerForm;
