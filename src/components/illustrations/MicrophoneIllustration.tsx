/**
 * MicrophoneIllustration -- hand-drawn microphone with warm halo.
 *
 * Used by VoiceOnboardingSheet. Inline SVG so no asset pipeline dependency.
 * Hand-drawn aesthetic: imperfect curves, slight wobble on stroke, warm
 * accent halo behind the mic body. Fixed 200x200 viewBox; scales via the
 * `size` prop.
 *
 * Color tokens: uses Tailwind/CSS-var foreground colors so it adapts to
 * dark/light themes automatically. The warm halo uses the brand primary
 * with low alpha.
 */

interface MicrophoneIllustrationProps {
  size?: number;
}

const MicrophoneIllustration = ({ size = 180 }: MicrophoneIllustrationProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Warm halo - brand primary at low alpha, slightly off-center for organic feel */}
    <ellipse
      cx="108"
      cy="62"
      rx="42"
      ry="38"
      fill="hsl(var(--primary) / 0.45)"
      transform="rotate(-8 108 62)"
    />

    {/* Microphone capsule (top oval) - hand-drawn feel via slightly imperfect path */}
    <path
      d="M 100 38
         C 112 38, 121 47, 121 60
         L 121 92
         C 121 105, 112 114, 100 114
         C 88 114, 79 105, 79 92
         L 79 60
         C 79 47, 88 38, 100 38 Z"
      fill="hsl(var(--background))"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Capsule grille lines - three subtle horizontal strokes */}
    <line x1="89" y1="62" x2="111" y2="62" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    <line x1="89" y1="76" x2="111" y2="76" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    <line x1="89" y1="90" x2="111" y2="90" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" opacity="0.35" />

    {/* Yoke arms - U-shape under the capsule */}
    <path
      d="M 64 92
         C 64 116, 80 132, 100 132
         C 120 132, 136 116, 136 92"
      fill="none"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
      strokeLinecap="round"
    />

    {/* Stem - vertical line down from yoke center */}
    <line
      x1="100"
      y1="132"
      x2="100"
      y2="160"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
      strokeLinecap="round"
    />

    {/* Base - horizontal line at the bottom */}
    <line
      x1="76"
      y1="160"
      x2="124"
      y2="160"
      stroke="hsl(var(--foreground))"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

export default MicrophoneIllustration;
