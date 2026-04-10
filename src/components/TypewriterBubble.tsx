import { motion } from "framer-motion";
import useTypewriter from "@/hooks/use-typewriter";
import SevenLogo from "@/components/SevenLogo";

interface TypewriterBubbleProps {
  text: string;
}

const TypewriterBubble = ({ text }: TypewriterBubbleProps) => {
  const { displayed, done } = useTypewriter(text, 18);

  return (
    <div className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed text-foreground">
      <div className="flex items-center gap-2 mb-2">
        <SevenLogo size={16} />
        <span className="text-[12px] font-medium text-muted-foreground">Seven</span>
      </div>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 align-middle"
        />
      )}
    </div>
  );
};

export default TypewriterBubble;
