/**
 * Common validation functions for use with InputField component
 * Each function returns true if valid, or an error message string if invalid
 */

export const validations = {
  /**
   * Email validation
   */
  email: (value) => {
    if (!value) return true; // Allow empty values
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? true : 'Please enter a valid email address';
  },

  /**
   * Strong password validation
   * Requires: min 8 chars, uppercase, lowercase, number, special char
   */
  strongPassword: (value) => {
    if (!value) return true;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(value)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&#])/.test(value)) {
      return 'Password must contain at least one special character (@$!%*?&#)';
    }
    return true;
  },
 
  /**
   * Medium password validation
   * Requires: min 8 chars, uppercase, lowercase, number
   */
  mediumPassword: (value) => {
    if (!value) return true;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return 'Password must contain uppercase, lowercase, and number';
    }
    return true;
  },

  /**
   * Phone number validation (US format)
   */
  phoneUS: (value) => {
    if (!value) return true;
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(value) ? true : 'Please enter a valid phone number';
  },

  /**
   * URL validation
   */
  url: (value) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com)';
    }
  },

  /**
   * Alphanumeric only (letters and numbers)
   */
  alphanumeric: (value) => {
    if (!value) return true;
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return alphanumericRegex.test(value) ? true : 'Only letters and numbers are allowed';
  },

  /**
   * Letters only (no numbers or special characters)
   */
  lettersOnly: (value) => {
    if (!value) return true;
    const lettersRegex = /^[a-zA-Z\s]+$/;
    return lettersRegex.test(value) ? true : 'Only letters are allowed';
  },

  /**
   * Numbers only
   */
  numbersOnly: (value) => {
    if (!value) return true;
    const numbersRegex = /^[0-9]+$/;
    return numbersRegex.test(value) ? true : 'Only numbers are allowed';
  },

  /**
   * No spaces allowed
   */
  noSpaces: (value) => {
    return !value.includes(' ') ? true : 'Spaces are not allowed';
  },

  /**
   * Username validation (alphanumeric, underscore, hyphen)
   */
  username: (value) => {
    if (!value) return true;
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must not exceed 20 characters';
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(value) 
      ? true 
      : 'Username can only contain letters, numbers, underscores, and hyphens';
  },

  /**
   * Credit card number validation (basic Luhn algorithm)
   */
  creditCard: (value) => {
    if (!value) return true;
    
    // Remove spaces and hyphens
    const cleaned = value.replace(/[\s-]/g, '');
    
    if (!/^\d{13,19}$/.test(cleaned)) {
      return 'Credit card number must be 13-19 digits';
    }
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0 ? true : 'Please enter a valid credit card number';
  },

  /**
   * Zip code validation (US 5 or 9 digit)
   */
  zipCode: (value) => {
    if (!value) return true;
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(value) ? true : 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)';
  },

  /**
   * Date validation (YYYY-MM-DD format)
   */
  dateFormat: (value) => {
    if (!value) return true;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return 'Please use YYYY-MM-DD format';
    }
    const date = new Date(value);
    return !isNaN(date.getTime()) ? true : 'Please enter a valid date';
  },

  /**
   * Age validation (18+)
   */
  minAge18: (value) => {
    if (!value) return true;
    const age = parseInt(value);
    if (isNaN(age)) {
      return 'Please enter a valid age';
    }
    return age >= 18 ? true : 'You must be at least 18 years old';
  },

  /**
   * IP Address validation (IPv4)
   */
  ipAddress: (value) => {
    if (!value) return true;
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(value) ? true : 'Please enter a valid IP address';
  },

  /**
   * Custom min/max value validation generator
   */
  numberRange: (min, max) => {
    return (value) => {
      if (!value) return true;
      const num = parseFloat(value);
      if (isNaN(num)) {
        return 'Please enter a valid number';
      }
      if (num < min) {
        return `Value must be at least ${min}`;
      }
      if (num > max) {
        return `Value must not exceed ${max}`;
      }
      return true;
    };
  },

  /**
   * Custom regex validation generator
   */
  customRegex: (regex, errorMessage) => {
    return (value) => {
      if (!value) return true;
      return regex.test(value) ? true : errorMessage;
    };
  },

  /**
   * Match another field (useful for password confirmation)
   */
  matchField: (otherValue, fieldName = 'password') => {
    return (value) => {
      return value === otherValue 
        ? true 
        : `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}s do not match`;
    };
  },

  /**
   * File extension validation (for file input type)
   */
  fileExtension: (allowedExtensions = []) => {
    return (value) => {
      if (!value) return true;
      const extension = value.split('.').pop().toLowerCase();
      return allowedExtensions.includes(extension)
        ? true
        : `Only ${allowedExtensions.join(', ')} files are allowed`;
    };
  },

  /**
   * Contains no profanity (basic example - expand as needed)
   */
  noProfanity: (value) => {
    if (!value) return true;
    const profanityList = ['badword1', 'badword2']; // Add your list
    const lowerValue = value.toLowerCase();
    const hasProfanity = profanityList.some(word => lowerValue.includes(word));
    return hasProfanity ? 'Please use appropriate language' : true;
  },
};

/**
 * Compose multiple validations
 * @param {...Function} validators - Validation functions to combine
 */
export const composeValidations = (...validators) => {
  return validators.filter(Boolean);
};

/**
 * Create a required validation
 */
export const required = (message = 'This field is required') => {
  return (value) => {
    return value && value.trim().length > 0 ? true : message;
  };
};

export default validations;
