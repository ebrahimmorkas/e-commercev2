/**
 * Central color theme for the Abandoned Cart feature.
 * Re-theme this feature by editing this file only.
 */
const theme = {
  text: {
    heading: 'text-gray-900',
    subheading: 'text-gray-500',
    body: 'text-gray-600',
    muted: 'text-gray-400',
  },
  alert: {
    error: {
      background: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
  },
  badge: {
    itemCount: 'blue',
    source: {
      LOGGED_IN: 'green',
      GUEST_KNOWN: 'yellow',
      COMBINED: 'purple',
    },
  },
};

export default theme;
