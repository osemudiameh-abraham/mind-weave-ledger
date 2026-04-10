import { useState } from "react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import SideMenu from "@/components/SideMenu";
import { useReminders } from "@/hooks/use-reminders";
import { useSections } from "@/hooks/use-sections";

interface AppLayoutProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}

const AppLayout = ({ children, hideBottomNav }: AppLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { reminders, unseen, addReminder, dismissReminder, markAllSeen } = useReminders();
  const {
    sections,
    activeSectionId,
    setActiveSectionId,
    createSection,
    renameSection,
    deleteSection,
    toggleHideSection,
  } = useSections();

  return (
    <div className="min-h-screen bg-background">
      <SideMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        sections={sections}
        activeSectionId={activeSectionId}
        onNewSection={() => createSection()}
        onSelectSection={setActiveSectionId}
        onRenameSection={renameSection}
        onDeleteSection={deleteSection}
        onToggleHideSection={toggleHideSection}
      />
      <TopNav
        onMenuClick={() => setMenuOpen(true)}
        reminders={reminders}
        unseenCount={unseen.length}
        onAddReminder={addReminder}
        onDismissReminder={dismissReminder}
        onMarkAllSeen={markAllSeen}
      />
      {children}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default AppLayout;
