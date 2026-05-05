/**
 * LiveIllustration -- hand-drawn camera/lens composition for Live mode.
 *
 * Used by LiveOnboardingSheet. Inline SVG, hand-drawn aesthetic. The
 * camera lens with concentric rings evokes an aware, watching presence;
 * sparkle accents suggest sensing/perception (camera + mic + screen
 * together). Uses the brand secondary purple accent color the home
 * greeting headline already uses, to differentiate from the Voice sheet's
 * primary-warm palette.
 */

interface LiveIllustrationProps {
  size?: number;
}

const LiveIllustration = ({ size = 180 }: LiveIllustrationProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Warm halo - brand primary at low alpha, off-center for organic feel.
        Matches MicrophoneIllustration's halo treatment for brand consistency
        across onboarding sheets. */}
    <ellipse
      cx="92"
      cy="98"
      rx="58"
      ry="50"
      fill="hsl(var(--primary) / 0.45)"
      transform="rotate(-12 92 98)"
    />

    {/* Outer camera body - rounded rectangle */}
    <path
      d="M 50 78
         C 50 70, 56 64, 64 64
         L 76 64
         L 82 56
         L 118 56
         L 124 64
         L 136 64
         C 144 64, 150 70, 150 78
         L 150 138
         C 150 146, 144 152, 136 152
         L 64 152
         C 56 152, 50 146, 50 138
         Z"
      fill="hsl(var(--background))"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />

    {/* Outer lens ring */}
    <circle
      cx="100"
      cy="108"
      r="28"
      fill="none"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
    />

    {/* Inner lens ring */}
    <circle
      cx="100"
      cy="108"
      r="18"
      fill="none"
      stroke="hsl(var(--foreground))"
      strokeWidth="2.5"
      opacity="0.55"
    />

    {/* Lens center pupil */}
    <circle
      cx="100"
      cy="108"
      r="7"
      fill="hsl(var(--foreground))"
    />

    {/* Lens highlight - small white dot on upper-left of pupil */}
    <circle
      cx="96"
      cy="104"
      r="2"
      fill="hsl(var(--background))"
    />

    {/* Top status light - small filled dot, on the camera body. Brand primary
        for the "active sensing" cue. */}
    <circle
      cx="132"
      cy="78"
      r="3.5"
      fill="hsl(var(--primary))"
    />

    {/* Sparkle 1 - upper right, four-point star */}
    <path
      d="M 162 50
         L 164 60
         L 174 62
         L 164 64
         L 162 74
         L 160 64
         L 150 62
         L 160 60 Z"
      fill="hsl(var(--foreground))"
      opacity="0.65"
    />

    {/* Sparkle 2 - lower left, smaller four-point star */}
    <path
      d="M 36 156
         L 37 162
         L 43 163
         L 37 164
         L 36 170
         L 35 164
         L 29 163
         L 35 162 Z"
      fill="hsl(var(--foreground))"
      opacity="0.55"
    />

    {/* Sparkle 3 - upper left, tiny star */}
    <path
      d="M 42 42
         L 43 47
         L 48 48
         L 43 49
         L 42 54
         L 41 49
         L 36 48
         L 41 47 Z"
      fill="hsl(var(--foreground))"
      opacity="0.45"
    />
  </svg>
);

export default LiveIllustration;
