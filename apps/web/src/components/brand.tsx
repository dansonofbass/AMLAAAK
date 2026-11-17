export function BrandSymbol({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#1d2540" />
      <path
        d="M8 18 20 8l12 10v14H8Z"
        stroke="#a795ff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 27v-4m6 4V17m6 10v-7"
        stroke="#53dce5"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
