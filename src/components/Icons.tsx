// Іконки меню (контурні, 24×24, stroke = currentColor)
import type { JSX } from 'solid-js';

function Svg(props: { children: JSX.Element }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export const StudyIcon = () => (
  <Svg>
    <rect x="3" y="7" width="15" height="11" rx="2.5" />
    <path d="M7 4h11.5A2.5 2.5 0 0 1 21 6.5V14" />
    <path d="M9.5 10.5 13 12.5l-3.5 2z" fill="currentColor" />
  </Svg>
);

export const CardsIcon = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </Svg>
);

export const LibraryIcon = () => (
  <Svg>
    <path d="M4 4h4v16H4zM10 4h4v16h-4z" />
    <path d="m15.5 5.2 3.8-1 3.2 14.8-3.8 1z" />
  </Svg>
);

export const StatsIcon = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);

export const ProfileIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

export const Logo = (props: { size?: number }) => (
  <svg width={props.size ?? 28} height={props.size ?? 28} viewBox="18 18 72 72" aria-hidden="true">
    {/* як логотип myDay: суцільний синій квадратик */}
    <rect x="18" y="18" width="72" height="72" rx="20" fill="#2169EB" />
    <g transform="translate(58 50) rotate(9)">
      <rect x="-23" y="-17" width="46" height="34" rx="5" fill="#fff" fill-opacity="0.45" />
    </g>
    <g transform="translate(53 57) rotate(-5)">
      <rect x="-23" y="-17" width="46" height="34" rx="5" fill="#fff" />
      <rect x="-15" y="-9" width="18" height="3.6" rx="1.8" fill="#2169EB" />
      <rect x="-15" y="-1.8" width="30" height="3.6" rx="1.8" fill="#C3D3F7" />
      <rect x="-15" y="5.4" width="22" height="3.6" rx="1.8" fill="#C3D3F7" />
    </g>
  </svg>
);
