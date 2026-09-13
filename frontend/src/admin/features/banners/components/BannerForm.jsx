import { useMemo } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import DatePicker from '../../../../components/common/DatePicker';
import Dropdown from '../../../../components/common/DropDown';
import Checkbox from '../../../../components/common/Checkbox';
import { RadioGroup } from '../../../../components/common/Radio';
import FileUpload from '../../../../components/common/FileUpload';
import Avatar from '../../../../components/common/Avatar';
import Button from '../../../../components/common/Buttons';
import { useToast } from '../../../../components/common/Toast';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const toDateOrNull = (value) => (value ? new Date(value) : null);

// Local YYYY-MM-DD, avoiding the UTC-shift toISOString() would introduce for a local-midnight Date
const toDateString = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildValidationSchema = (mode, mediaRequired) => {
  const schema = {
    name: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Name must be at least 2 characters'),
        (v) => (v.trim().length <= 20 ? true : 'Name must not exceed 20 characters'),
      ],
    },
    startDate: { required: true },
    endDate: { required: true },
    precedence: {
      required: false,
      validations: [
        (v) => (!v || (Number.isInteger(Number(v)) && Number(v) >= 1) ? true : 'Precedence must be a positive whole number'),
      ],
    },
  };

  if (mode === 'edit') {
    schema.status = { required: true };
  }

  if (mediaRequired) {
    schema.mediaFile = {
      validations: [(v) => (v ? true : 'An image or video file is required')],
    };
  }

  return schema;
};

/**
 * Add/Edit form for a banner. Built on the reusable Form orchestrator
 * (render-prop mode, since DatePicker/Dropdown/RadioGroup/FileUpload aren't
 * config-driven field types) so field state, touched/blur, and submit-gating
 * come for free.
 *
 * A banner has exactly one of image or video, never both - which type(s) a
 * vendor may pick from is driven entirely by CompanyMaster.isVideoUploadingFeatureOn
 * and CompanyMaster.mediaUploadAllowedInBanner (see useBannerLookups), mirroring
 * the same precedence the backend enforces in bannerValidations.js.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues - banner document when editing
 * @param {Object|null} props.companyMaster - CompanyMaster doc for the current vendor (null while loading/missing)
 * @param {(fields: Object, media: {image?: File, video?: File}) => Promise<boolean>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const BannerForm = ({ mode = 'add', initialValues = {}, companyMaster = null, onSubmit, onCancel, submitting = false }) => {
  const toast = useToast();

  const imageAllowed = useMemo(() => {
    const setting = companyMaster?.mediaUploadAllowedInBanner || 'image';
    return setting === 'image' || setting === 'both';
  }, [companyMaster]);

  const videoAllowed = useMemo(() => {
    const setting = companyMaster?.mediaUploadAllowedInBanner || 'image';
    const isVideoUploadingFeatureOn = companyMaster ? !!companyMaster.isVideoUploadingFeatureOn : false;
    return isVideoUploadingFeatureOn && (setting === 'video' || setting === 'both');
  }, [companyMaster]);

  const bothAllowed = imageAllowed && videoAllowed;
  const noneAllowed = !imageAllowed && !videoAllowed;

  // Mirrors resolveAllowedVideoFormats' fallback on the backend (falls back to
  // ['mp4'] when CompanyMaster doesn't set a list) - the frontend has no access
  // to WebsiteMaster's copy of this field, same limitation already accepted for
  // isVideoUploadingFeatureOn/mediaUploadAllowedInBanner above.
  const allowedVideoFormats = useMemo(() => {
    const formats = companyMaster?.allowedVideoFormat;
    return Array.isArray(formats) && formats.length > 0 ? formats : ['mp4'];
  }, [companyMaster]);

  const allowedVideoFormatsLabel = useMemo(() => {
    const upper = allowedVideoFormats.map((f) => f.toUpperCase());
    if (upper.length === 1) return upper[0];
    return `${upper.slice(0, -1).join(', ')} or ${upper[upper.length - 1]}`;
  }, [allowedVideoFormats]);

  const currentMediaType = initialValues.video ? 'video' : initialValues.image ? 'image' : null;
  const defaultMediaType =
    currentMediaType && (currentMediaType === 'image' ? imageAllowed : videoAllowed)
      ? currentMediaType
      : imageAllowed
        ? 'image'
        : 'video';

  const mediaTypeOptions = [
    imageAllowed && { value: 'image', label: 'Image' },
    videoAllowed && { value: 'video', label: 'Video' },
  ].filter(Boolean);

  const validationSchema = buildValidationSchema(mode, mode === 'add' && !noneAllowed);

  const formInitialValues = {
    name: initialValues.name || '',
    startDate: toDateOrNull(initialValues.startDate),
    endDate: toDateOrNull(initialValues.endDate),
    precedence: initialValues.precedence ?? '',
    status: initialValues.status || 'A',
    isDefault: !!initialValues.isDefault,
    mediaType: defaultMediaType,
    mediaFile: null,
  };

  const handleFormSubmit = async (values) => {
    if (values.startDate && values.endDate && new Date(values.endDate) <= new Date(values.startDate)) {
      toast.error('End date must be after the start date');
      return;
    }

    const fields = {
      name: values.name.trim(),
      startDate: toDateString(values.startDate),
      endDate: toDateString(values.endDate),
    };

    if (values.precedence !== '' && values.precedence !== undefined && values.precedence !== null) {
      fields.precedence = Number(values.precedence);
    }

    if (mode === 'edit') {
      fields.status = values.status;
      if (values.isDefault) fields.isDefault = true;
    }

    const media = {};
    if (values.mediaFile) {
      media[values.mediaType] = values.mediaFile;
    }

    await onSubmit(fields, media);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];

        return (
          <>
            <div>
              <InputField
                label="Name"
                name="name"
                placeholder="e.g. Summer Sale"
                value={values.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                required
                maxLength={20}
                showError={false}
              />
              {showError('name') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Start Date"
                name="startDate"
                value={values.startDate}
                onChange={(date) => setFieldValue('startDate', date)}
                required
                error={showError('startDate') ? errors.startDate : ''}
              />
              <DatePicker
                label="End Date"
                name="endDate"
                value={values.endDate}
                onChange={(date) => setFieldValue('endDate', date)}
                minDate={values.startDate || undefined}
                required
                error={showError('endDate') ? errors.endDate : ''}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <InputField
                  type="number"
                  label="Precedence"
                  name="precedence"
                  placeholder="Display order (auto if left blank)"
                  value={values.precedence}
                  onChange={handleChange('precedence')}
                  onBlur={handleBlur('precedence')}
                  min={1}
                  showError={false}
                />
                {showError('precedence') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.precedence}</p>}
              </div>

              {mode === 'edit' && (
                <Dropdown
                  label="Status"
                  name="status"
                  options={STATUS_OPTIONS}
                  value={values.status}
                  onChange={(val) => setFieldValue('status', val)}
                  required
                  error={showError('status') ? errors.status : ''}
                />
              )}
            </div>

            {mode === 'edit' && !initialValues.isDefault && (
              <Checkbox
                label="Make this the default banner"
                description="Only one banner can be default; it always shows first."
                checked={values.isDefault}
                onChange={handleChange('isDefault')}
              />
            )}

            {noneAllowed ? (
              <p className={`text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>
                Neither image nor video uploads are currently enabled for banners on this account. Contact support to enable one.
              </p>
            ) : (
              <div className="space-y-3">
                {(initialValues.image || initialValues.video) && (
                  <div>
                    <p className={`text-sm ${theme.text.muted} mb-2`}>Current media - upload a new file below to replace it.</p>
                    {initialValues.image ? (
                      <Avatar src={initialValues.image} name={values.name} shape="square" size="lg" />
                    ) : initialValues.video ? (
                      <video src={initialValues.video} controls className="h-28 rounded-lg border border-gray-200" />
                    ) : null}
                  </div>
                )}

                {bothAllowed && (
                  <RadioGroup
                    label="Media Type"
                    name="mediaType"
                    options={mediaTypeOptions}
                    value={values.mediaType}
                    onChange={(val) => {
                      setFieldValue('mediaType', val);
                      setFieldValue('mediaFile', null);
                    }}
                    direction="horizontal"
                    required
                  />
                )}

                {values.mediaType === 'image' ? (
                  <FileUpload
                    key="image"
                    label={initialValues.image ? 'Replace Image' : 'Banner Image'}
                    accept="image/*"
                    maxSize={5 * 1024 * 1024}
                    onFilesSelected={(files) => setFieldValue('mediaFile', files[0] || null)}
                    helperText="JPG, JPEG or PNG. Up to 5MB."
                    error={showError('mediaFile') ? errors.mediaFile : ''}
                  />
                ) : (
                  <FileUpload
                    key="video"
                    label={initialValues.video ? 'Replace Video' : 'Banner Video'}
                    accept={allowedVideoFormats.map((f) => `.${f.toLowerCase()}`).join(',')}
                    onFilesSelected={(files) => setFieldValue('mediaFile', files[0] || null)}
                    helperText={`${allowedVideoFormatsLabel}. The exact size limit depends on your account settings.`}
                    error={showError('mediaFile') ? errors.mediaFile : ''}
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting} disabled={noneAllowed}>
                {mode === 'edit' ? 'Save Changes' : 'Add Banner'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default BannerForm;
