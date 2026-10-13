/** Siletry "care bubble" mark: a chat bubble with a medical plus. */
export function LogoMark({ size = 32, bubble = '#1A6650', plus = '#F5F1EA' }: { size?: number; bubble?: string; plus?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <rect x="4" y="4" width="92" height="74" rx="22" fill={bubble} />
      <path d="M20 70 L14 96 L44 76 Z" fill={bubble} />
      <rect x="42" y="20" width="16" height="42" rx="3" fill={plus} />
      <rect x="29" y="33" width="42" height="16" rx="3" fill={plus} />
    </svg>
  );
}

/**
 * Mark + "siletry" wordmark.
 * tone="dark" is for dark backgrounds (amber bubble, cream text), "light" for light ones.
 */
export default function Logo({ size = 30, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <span className="logo" aria-label="Siletry" role="img">
      <LogoMark size={size} bubble={dark ? '#F2B43C' : '#1A6650'} plus={dark ? '#12221F' : '#F5F1EA'} />
      <span className="logo-word" style={{ fontSize: size * 0.86, color: dark ? '#F5F1EA' : '#12221F' }}>siletry</span>
    </span>
  );
}
