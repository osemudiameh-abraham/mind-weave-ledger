interface SevenLogoProps {
  size?: number;
  className?: string;
}

const SevenLogo = ({ size = 32, className = "" }: SevenLogoProps) => {
  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 36 28"
      fill="none"
      className={className}
    >
      <path
        d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z"
        fill="hsl(var(--primary))"
      />
    </svg>
  );
};

export default SevenLogo;
