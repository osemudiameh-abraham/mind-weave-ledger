import sevenLogo from "@/assets/seven-logo.png";

interface SevenLogoProps {
  size?: number;
  className?: string;
}

const SevenLogo = ({ size = 32, className = "" }: SevenLogoProps) => {
  return (
    <img
      src={sevenLogo}
      alt="Seven"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
};

export default SevenLogo;
