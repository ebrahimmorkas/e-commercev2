const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
};

export const NotFoundIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35M9 10h.01M13 10h.01M9.5 14.5c.6.6 1.4 1 2.5 1s1.9-.4 2.5-1" />
  </svg>
);

export const ForbiddenIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 15v2m-6 3h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm1-10V7a5 5 0 0110 0v2" />
  </svg>
);

export const UnauthorizedIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4zm0 7v4m0 4h.01" />
  </svg>
);

export const ServerErrorIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 6h16M4 6a2 2 0 012-2h12a2 2 0 012 2m-16 0v4a2 2 0 002 2h12a2 2 0 002-2V6m-16 8a2 2 0 012-2h12a2 2 0 012 2m-16 0v4a2 2 0 002 2h12a2 2 0 002-2v-4M7 8h.01M7 16h.01" />
  </svg>
);

export const BadRequestIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 003.82 21h16.36a2 2 0 001.71-3.03l-8.18-14.18a2 2 0 00-3.42 0z" />
  </svg>
);

export const NetworkErrorIcon = () => (
  <svg className="w-full h-full" {...strokeProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
  </svg>
);
