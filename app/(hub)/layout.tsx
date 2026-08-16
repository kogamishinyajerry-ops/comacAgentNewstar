import "@/styles/tokens.css";
import { HubHeader } from "@/components/hub/hub-header";
import { HubFooter } from "@/components/hub/hub-footer";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub-root">
      <a href="#hub-main" className="hub-skip-link">
        跳到主要内容
      </a>
      <HubHeader />
      <main id="hub-main" className="hub-main">
        {children}
      </main>
      <HubFooter />
    </div>
  );
}
