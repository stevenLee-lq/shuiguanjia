import React from 'react';

type Props = {
  size?: number;
  className?: string;
};

/**
 * 公共供水龙头图标：山水横幅上使用青绿↔湖水蓝渐变，与自然背景协调；
 * 水滴略提亮，便于在绿树/蓝天底上辨认。
 */
export function PublicWaterSupplyLogo({ size = 22, className }: Props) {
  const uid = React.useId().replace(/:/g, '');
  const gMetal = `pws-m-${uid}`;
  const gDrop = `pws-d-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gMetal} x1="4" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecfdf5" />
          <stop offset="0.45" stopColor="#5eead4" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id={gDrop} x1="18" y1="21" x2="26" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#cffafe" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>

      <rect x="2" y="14.5" width="6.5" height="11" rx="2" fill={`url(#${gMetal})`} opacity="0.97" />
      <rect x="7.5" y="15.5" width="13.5" height="5.5" rx="2.75" fill={`url(#${gMetal})`} />
      <rect x="17.5" y="19" width="7" height="9.5" rx="3.5" fill={`url(#${gMetal})`} />
      <rect x="9.5" y="3" width="13" height="6.5" rx="3.25" fill={`url(#${gMetal})`} />
      <rect x="14.5" y="9" width="3.5" height="7.5" rx="1.75" fill={`url(#${gMetal})`} />
      <ellipse cx="21" cy="20.8" rx="2.5" ry="1.5" fill="#fff7ed" fillOpacity="0.55" />
      <path
        fill={`url(#${gDrop})`}
        d="M21 21.2C18.2 23.2 18.2 26.2 21 28.2C23.8 26.2 23.8 23.2 21 21.2z"
      />
      <path
        fill={`url(#${gDrop})`}
        fillOpacity="0.96"
        d="M21 27c.7 0 1.3.8 1 1.5l-1 3.2-1-3.2c-.3-.7.3-1.5 1-1.5z"
      />
      <circle cx="21" cy="30.3" r="1.1" fill={`url(#${gDrop})`} fillOpacity="0.92" />
    </svg>
  );
}
