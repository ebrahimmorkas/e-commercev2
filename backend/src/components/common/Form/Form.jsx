import React, { useState } from 'react';
import InputField from '../InputField';
import TextArea from '../TextArea';
import Dropdown from '../DropDown';
import Checkbox from '../Checkbox';
import Button from '../Buttons';

/**
 * A form orchestrator that centralizes values/errors/touched state and
 * validate-all-on-submit, built on top of InputField/TextArea/Dropdown/Checkbox
 * and the shared utils/validations.js validators.
 *
 * Two ways to use it:
 * 1. Config-driven: pass `fields` and Form renders the inputs for you.
 * 2. Render-prop: pass a function as `children` for full control over layout,
 *    using any components you like (RadioGroup, Switch, etc.).
 *
 * @param {Object} props - Component properties
 * @param {Array} props.fields - Field definitions for config-driven mode:
 *   [{ name, type: 'text'|'email'|'password'|'number'|'tel'|'url'|'textarea'|'select'|'checkbox',
 *      label, placeholder, required, validations, options (for select), rows (for textarea), helperText }]
 * @param {Function} props.children - Render prop: ({ values, errors, touched, submitAttempted, isSubmitting,
 *   setFieldValue, handleChange, handleBlur, handleSubmit, handleReset }) => ReactNode
 * @param {Object} props.initialValues - Initial values keyed by field name
 * @param {Object} props.validationSchema - Validators for render-prop mode: { fieldName: { required, validations } }
 * @param {Function} props.onSubmit - (values) => void | Promise, called only when validation passes
 * @param {string} props.submitLabel - Submit button text
 * @param {string} props.resetLabel - Reset button text
 * @param {boolean} props.showReset - Show a reset button next to submit
 * @param {string} props.className - Additional CSS classes for the <form> element
 */
const Form = ({
  fields = [],
  children,
  initialValues = {},
  validationSchema = {},
  onSubmit,
  submitLabel = 'Submit',
  resetLabel = 'Reset',
  showReset = false,
  className = '',
}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema =
    fields.length > 0
      ? Object.fromEntries(fields.map((f) => [f.name, f]))
      : validationSchema;

  const validateField = (name, value) => {
    const rule = schema[name];
    if (!rule) return '';

    if (rule.required) {
      const isEmpty = rule.type === 'checkbox' ? !value : !String(value ?? '').trim();
      if (isEmpty) return 'This field is required';
    }

    if (rule.validations) {
      for (const validator of rule.validations) {
        const result = validator(value);
        if (result !== true) return result;
      }
    }

    return '';
  };

  const validateAll = () => {
    const nextErrors = {};
    Object.keys(schema).forEach((name) => {
      const message = validateField(name, values[name]);
      if (message) nextErrors[name] = message;
    });
    setErrors(nextErrors);
    return nextErrors;
  };

  const setFieldValue = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (touched[name] || submitAttempted) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleChange = (name) => (eOrValue) => {
    const value =
      eOrValue && eOrValue.target
        ? eOrValue.target.type === 'checkbox'
          ? eOrValue.target.checked
          : eOrValue.target.value
        : eOrValue;
    setFieldValue(name, value);
  };

  const handleBlur = (name) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values[name]) }));
  };

  const handleReset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setSubmitAttempted(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSubmitAttempted(true);
    setTouched(Object.fromEntries(Object.keys(schema).map((name) => [name, true])));

    const nextErrors = validateAll();
    if (Object.keys(nextErrors).length > 0) return;

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const formApi = {
    values,
    errors,
    touched,
    submitAttempted,
    isSubmitting,
    setFieldValue,
    handleChange,
    handleBlur,
    handleSubmit,
    handleReset,
  };

  const displayError = (name) => (touched[name] || submitAttempted ? errors[name] : '');

  const renderField = (field) => {
    const value = values[field.name];
    const error = displayError(field.name);

    if (field.type === 'select') {
      return (
        <Dropdown
          key={field.name}
          name={field.name}
          label={field.label}
          placeholder={field.placeholder}
          options={field.options || []}
          value={value ?? ''}
          onChange={(val) => setFieldValue(field.name, val)}
          required={field.required}
          error={error}
          helperText={field.helperText}
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <Checkbox
          key={field.name}
          name={field.name}
          label={field.label}
          description={field.helperText}
          checked={!!value}
          onChange={handleChange(field.name)}
          required={field.required}
          error={error}
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name}>
          <TextArea
            name={field.name}
            label={field.label}
            placeholder={field.placeholder}
            rows={field.rows}
            value={value ?? ''}
            onChange={handleChange(field.name)}
            onBlur={handleBlur(field.name)}
            required={field.required}
            showError={false}
          />
          {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
        </div>
      );
    }

    return (
      <div key={field.name}>
        <InputField
          type={field.type || 'text'}
          name={field.name}
          label={field.label}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={handleChange(field.name)}
          onBlur={handleBlur(field.name)}
          required={field.required}
          showError={false}
        />
        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
    );
  };

  const hasErrorSummary = submitAttempted && Object.keys(errors).length > 0;

  return (
    <form className={`space-y-5 ${className}`} onSubmit={handleSubmit} onReset={handleReset} noValidate>
      {children ? (
        children(formApi)
      ) : (
        <>
          {fields.map(renderField)}

          {hasErrorSummary && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2" role="alert">
              Please fix the highlighted fields before submitting.
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {submitLabel}
            </Button>
            {showReset && (
              <Button type="reset" variant="ghost">
                {resetLabel}
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
};

export default Form;
