import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const Terms = () => {
  return (
    <AppLayout>
      <div className="pt-14 pb-24 px-4 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-2 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Terms of Service</h1>
              <p className="text-[12px] text-muted-foreground">Effective: April 2026</p>
            </div>
          </div>
        </motion.div>

        <div className="prose prose-sm text-[14px] text-foreground/80 leading-relaxed space-y-6">
          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Seven Mynd ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>Seven Mynd is a cognitive continuity platform that helps you track decisions, detect behavioural patterns, and maintain an intelligent memory of your personal and professional life. The Service uses artificial intelligence to process your conversations and extract meaningful insights.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use the Service.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">4. Your Data</h2>
            <p>You retain ownership of all content you provide to the Service, including messages, documents, decisions, and personal information. We process your data solely to provide and improve the Service. See our Privacy Policy for full details on data handling.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">5. Acceptable Use</h2>
            <p>You agree not to use the Service to: violate any applicable law or regulation, infringe on the rights of others, transmit harmful or malicious content, attempt to gain unauthorised access to the Service or its systems, or use the Service for any purpose other than its intended personal productivity use.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">6. AI-Generated Content</h2>
            <p>The Service uses artificial intelligence to generate responses, detect patterns, and provide recommendations. AI-generated content is provided for informational purposes only and should not be considered professional advice (legal, medical, financial, or otherwise). You are responsible for your own decisions.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">7. Service Availability</h2>
            <p>We strive to provide continuous access to the Service but do not guarantee uninterrupted availability. We may modify, suspend, or discontinue any aspect of the Service at any time with reasonable notice.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">8. Beta Programme</h2>
            <p>During the beta period, the Service is provided free of charge. Beta features may be experimental and subject to change. We welcome your feedback to help improve the Service.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">9. Subscription and Payment</h2>
            <p>Following the beta period, continued access to the Service will require a paid subscription. Pricing, billing terms, and cancellation policies will be communicated before any charges apply. You will never be charged without explicit consent.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">10. Account Deletion</h2>
            <p>You may delete your account at any time through the Settings page. Upon deletion, all your data will be permanently removed from our systems within 30 days, in compliance with applicable data protection regulations.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">11. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Seven Mynd and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">12. Governing Law</h2>
            <p>These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">13. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of any material changes via the Service or email. Continued use after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-foreground mb-2">14. Contact</h2>
            <p>For questions about these Terms, contact us at legal@sevenmynd.com.</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
};

export default Terms;
