import { Hero } from "@/components/hub/hero";
import { ValueNarrative } from "@/components/hub/value-narrative";
import { JourneyTrack } from "@/components/hub/journey-track";
import { CoachFlow } from "@/components/hub/coach-flow";
import { RoleSection } from "@/components/hub/role-section";
import { Boundaries } from "@/components/hub/boundaries";
import { FinalCta } from "@/components/hub/final-cta";
import { FaqList } from "@/components/hub/faq-list";
import { Reveal } from "@/components/hub/reveal";
import { coachPrivacyNotice } from "@/fixtures/coach-demo";

/**
 * 公共 Landing / Hub:A 顶部导航(布局内)→ B Hero → C 价值观 → D 实践路径
 * → E Coach 预览 → F 三类角色 → G 平台边界 → H 终局 CTA → I FAQ(页脚在布局内)。
 */
export default function HubHomePage() {
  return (
    <div className="atlas-home">
      <Hero />
      <ValueNarrative />
      <JourneyTrack />

      {/* 平面状态标记只说明场景变化；问题、判断与回答器承担交互语义。 */}
      <section
        id="coach-preview"
        className="hub-section atlas-section atlas-section--coach"
        aria-labelledby="coach-preview-title"
        data-atlas-chapter="03"
      >
        <div className="hub-container">
          <Reveal>
            <p className="hub-eyebrow">一次只做一个决定</p>
            <h2 id="coach-preview-title" className="hub-title mt-4 max-w-[640px]">
              AI Coach,一次只追问一个关键问题
            </h2>
            <p className="hub-body mt-4 max-w-[560px]">
              试着回答三问。它不会夸你,只会把模糊的想法一寸寸压实,
              最后凝结成一颗问题种子。
            </p>
          </Reveal>
          <Reveal className="atlas-coach-sheet mt-10">
            <CoachFlow entry="problem" orbIdPrefix="home-coach" compact />
          </Reveal>
          <Reveal>
            <p className="hub-caption mt-7 max-w-[560px]">
              {coachPrivacyNotice}
            </p>
          </Reveal>
        </div>
      </section>

      <RoleSection />
      <Boundaries />
      <FinalCta />
      <FaqList />
    </div>
  );
}
