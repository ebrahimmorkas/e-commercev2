/**
 * Central color theme for the Send Email feature. Every component in this
 * feature pulls its colors (and variant choices for shared components) from
 * here instead of hardcoding them inline.
 */
const theme = {
  text: {
    heading: 'text-gray-900',
    body: 'text-gray-600',
    muted: 'text-gray-400',
    error: 'text-red-600',
  },
  badge: {
    SENDING: 'blue',
    COMPLETED: 'green',
    STOPPED: 'yellow',
    SENT: 'green',
    FAILED: 'red',
    SKIPPED: 'gray',
    PENDING: 'blue',
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
    ghost: 'ghost',
  },
};

export default theme;
