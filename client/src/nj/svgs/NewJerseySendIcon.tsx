/**
 * SVG of New Jersey's "send chat prompt".
 *
 * @param height sets the width/height of the icon
 */
export default function NewJerseySendIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 8C0 3.58172 3.58172 0 8 0H24C28.4183 0 32 3.58172 32 8V24C32 28.4183 28.4183 32 24 32H8C3.58172 32 0 28.4183 0 24V8Z"
        fill="#0076D6"
      />
      <g clipPath="url(#clip0_2340_2290)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M22 21.9948L16 8.00146L10 21.9948L14.6667 22.0015L16 12.0015L17.3333 22.0015L22 21.9948Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_2340_2290">
          <rect width={16} height={16} fill="white" transform="matrix(0 -1 1 0 8 22.668)" />
        </clipPath>
      </defs>
    </svg>
  );
}
