import { Hero } from "@/components/hub/hero";
import { ValueNarrative } from "@/components/hub/value-narrative";
import { JourneyTrack } from "@/components/hub/journey-track";
import { CoachFlow } from "@/components/hub/coach-flow";
import { RoleSection } from "@/components/hub/role-section";
import { Boundaries } from "@/components/hub/boundaries";
import { FinalCta } from "@/components/hub/final-cta";
import { FaqList } from "@/components/hub/faq-list";
import { Reveal } from "@/components/hub/reveal";

/**
 * 公共 Landing / Hub:A 顶部导航(布局内)→ B Hero → C 价值观 → D 实践路径
 * → E Coach 预览 → F 三类角色 → G 平台边界 → H 终局 CTA → I FAQ(页脚在布局内)。
 */
export default function HubHomePage() {
  return (
    <>
      <Hero />
      <ValueNarrative />
      <JourneyTrack />

      {/* E:AI Coach 互动预览——初始只有光核、一个问题、一个回答器 */}
      <section
        id="coach-preview"
        className="hub-section border-y border-[var(--border-subtle)] bg-[var(--surface-focus)]"
        aria-labelledby="coach-preview-title"
      >
        <div className="hub-container">
          <Reveal>
            <p className="hub-eyebrow justify-center">先见一面</p>
            <h2 id="coach-preview-title" className="hub-title mx-auto mt-4 max-w-[640px] text-center">
              AI Coach,一次只追问一个关键问题
            </h2>
            <p className="hub-body mx-auto mt-4 max-w-[520px] text-center">
              试着回答三问。它不会夸你,只会把模糊的想法一寸寸压实,
              最后凝结成一颗问题种子。
            </p>
          </Reveal>
          <Reveal className="mx-auto mt-12 max-w-[860px]">
            <CoachFlow entry="problem" orbIdPrefix="home-coach" compact />
          </Reveal>
          <Reveal>
            <p className="hub-caption mx-auto mt-10 max-w-[520px] text-center">
              本模块为确定性前端预览,未接入真实 AI 服务;你的回答只保留在本页。
            </p>
          </Reveal>
        </div>
      </section>

      <RoleSection />
      <Boundaries />
      <FinalCta />
      <FaqList />
    </>
  );
}
