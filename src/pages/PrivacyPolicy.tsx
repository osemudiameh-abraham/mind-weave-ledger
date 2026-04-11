import { motion } from "framer-motion";
import { Shield, Lock, Eye, Trash2, Download, Mail } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const PrivacyPolicy = () => {
  return (
    <AppLayout>
      <div className="pt-14 pb-24 px-4 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Privacy Policy</h1>
              <p className="text-[12px] text-muted-foreground">Version 1.0 · Effective 10 April 2026</p>
            </div>
          </div>
        </motion.div>

        {/* Trust banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6"
        >
          <p className="text-[14px] font-medium text-foreground leading-relaxed">
            Your memory, your decisions, and your identity data belong to you — not to us.
          </p>
          <div className="flex flex-col gap-2 mt-3">
            {[
              "We never sell your data",
              "We never use your data to train AI models",
              "We never share your data with advertisers",
              "You can delete everything at any time",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Lock size={12} className="text-primary shrink-0" />
                <span className="text-[13px] text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sections */}
        <div className="flex flex-col gap-5">
          <PolicySection
            index={0}
            title="1. Information We Collect"
            subsections={[
              {
                subtitle: "Information You Provide",
                items: [
                  "Account information: email, name, profile details",
                  "Identity information: role, company, city, timezone, goals",
                  "Conversation data: messages, voice transcripts, decisions",
                  "Decision records: logged decisions, review dates, outcomes",
                  "Documents: files you upload for processing",
                ],
              },
              {
                subtitle: "Collected Automatically",
                items: [
                  "Usage data: features used, session duration, interaction patterns",
                  "Device information: device type, OS version, app version",
                  "Voice data: processed in real time — raw audio is never stored",
                  "IP address: for security and fraud prevention only",
                ],
              },
              {
                subtitle: "Third-Party Services (With Your Consent)",
                items: [
                  "Google Account: email and name via OAuth sign-in",
                  "Gmail: send emails on your behalf (per-email approval required)",
                  "Google Calendar: add events (per-event approval required)",
                ],
                note: "Seven never reads your inbox or calendar without explicit consent. Every action requires your individual approval.",
              },
            ]}
          />

          <PolicySection
            index={1}
            title="2. How We Use Your Information"
            subsections={[
              {
                subtitle: "Core Service",
                items: [
                  "Personalised AI responses grounded in your memory and identity",
                  "Store decisions, outcomes, and facts for cross-session recall",
                  "Detect behavioural patterns and surface protective warnings",
                  "Send review reminders when decisions are due",
                  "Execute governed actions you explicitly approve",
                ],
              },
              {
                subtitle: "What We Do NOT Do",
                items: [
                  "We do NOT sell your personal data to third parties",
                  "We do NOT use conversations to train AI models",
                  "We do NOT use your data for advertising or profiling",
                  "We do NOT share your data with data brokers",
                ],
              },
            ]}
          />

          <PolicySection
            index={2}
            title="3. Data Storage & Security"
            subsections={[
              {
                subtitle: "Security Measures",
                items: [
                  "All data encrypted in transit using TLS 1.3",
                  "Sensitive fields encrypted at rest using AES-256-GCM with per-row keys",
                  "Row Level Security (RLS) — no user can access another's data",
                  "OAuth tokens stored encrypted, never exposed client-side",
                  "Regular security audits and vulnerability assessments",
                ],
              },
              {
                subtitle: "Data Minimisation",
                items: [
                  "Voice audio is never stored — only transcripts",
                  "Raw documents processed and discarded unless you save them",
                  "No user ID or email sent to third-party AI services",
                ],
              },
            ]}
          />

          <PolicySection
            index={3}
            title="4. Data Retention"
            subsections={[
              {
                subtitle: "Retention Periods",
                items: [
                  "Conversation history: until account deletion (deletable individually)",
                  "Memory facts: until account deletion or user deletion",
                  "Voice transcripts: until account deletion (raw audio never stored)",
                  "Uploaded documents: processing session only (unless saved)",
                  "Usage analytics: 24 months, aggregated and anonymised",
                  "Security logs: 12 months (fraud prevention)",
                ],
                note: "When you delete your account, all personal data is permanently deleted within 30 days.",
              },
            ]}
          />

          <PolicySection
            index={4}
            title="5. Third-Party Services"
            subsections={[
              {
                subtitle: "Services We Use",
                items: [
                  "Supabase: database & auth — data stored encrypted in EU",
                  "OpenAI: AI responses — message text only, no user ID",
                  "Deepgram: voice-to-text — audio stream only, not stored",
                  "ElevenLabs: text-to-speech — response text only",
                  "Resend: transactional email — email address & notification content",
                  "Google OAuth: sign-in & Gmail/Calendar — with explicit consent",
                ],
              },
            ]}
          />

          <PolicySection
            index={5}
            title="6. Your Rights"
            subsections={[
              {
                subtitle: "Under UK GDPR / EU GDPR / CCPA",
                items: [
                  "Right to Access: request a complete copy of your data",
                  "Right to Rectification: correct inaccurate or incomplete data",
                  "Right to Erasure: delete your account and all data (within 30 days)",
                  "Right to Portability: export all data in JSON from Settings",
                  "Right to Restriction: restrict processing in certain cases",
                  "Right to Object: object to processing based on legitimate interests",
                  "Right to Withdraw Consent: revoke permissions anytime from Settings",
                  "Right to Complain: lodge a complaint with the ICO (UK) or your national authority",
                ],
                note: "We respond to all rights requests within 30 days.",
              },
            ]}
          />

          <PolicySection
            index={6}
            title="7. Children's Privacy"
            subsections={[
              {
                subtitle: "",
                items: [
                  "Seven is not directed at children under 13 (or 16 in EU/UK)",
                  "We do not knowingly collect personal data from children",
                  "Contact hello@sevenmynd.com if you believe a child has provided data",
                ],
              },
            ]}
          />

          <PolicySection
            index={7}
            title="8. Cookies & Tracking"
            subsections={[
              {
                subtitle: "",
                items: [
                  "Essential cookies only: authentication and preferences",
                  "No advertising cookies, tracking pixels, or third-party profiling",
                  "You can control cookies through your browser settings",
                ],
              },
            ]}
          />

          <PolicySection
            index={8}
            title="9. Changes to This Policy"
            subsections={[
              {
                subtitle: "",
                items: [
                  "We notify you via email at least 30 days before material changes",
                  "A prominent notice is displayed in the app",
                  "You may delete your account if you do not agree to changes",
                ],
              },
            ]}
          />
        </div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-5 mt-6"
        >
          <h3 className="text-[14px] font-medium text-foreground mb-3">Contact & Data Controller</h3>
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-foreground/80">Seven Mynd Ltd</p>
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-muted-foreground" />
              <span className="text-[13px] text-primary">hello@sevenmynd.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={13} className="text-muted-foreground" />
              <span className="text-[13px] text-primary">privacy@sevenmynd.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-muted-foreground" />
              <span className="text-[13px] text-primary">dpo@sevenmynd.com</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            UK residents: lodge complaints with the ICO at ico.org.uk
            <br />
            EU residents: contact your national data protection authority
          </p>
        </motion.div>

        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          Seven Privacy Policy · Version 1.0 · 10 April 2026
          <br />
          Seven Mynd Ltd · sevenmynd.com
        </p>
      </div>
    </AppLayout>
  );
};

interface PolicySubsection {
  subtitle: string;
  items: string[];
  note?: string;
}

const PolicySection = ({
  index,
  title,
  subsections,
}: {
  index: number;
  title: string;
  subsections: PolicySubsection[];
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.08 + index * 0.03 }}
    className="bg-card border border-border rounded-2xl p-5"
  >
    <h2 className="text-[15px] font-medium text-foreground mb-3">{title}</h2>
    {subsections.map((sub, i) => (
      <div key={i} className={i > 0 ? "mt-4" : ""}>
        {sub.subtitle && (
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {sub.subtitle}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {sub.items.map((item, j) => (
            <div key={j} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
              <span className="text-[13px] text-foreground/80 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
        {sub.note && (
          <div className="mt-3 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-2.5">
            <p className="text-[12px] text-foreground/70 leading-relaxed">{sub.note}</p>
          </div>
        )}
      </div>
    ))}
  </motion.div>
);

export default PrivacyPolicy;
