import { jsonError } from "@/lib/auth";
import { projectAccess } from "@/lib/api-helpers";
import { runHardRules } from "@/lib/precheck";
import { runAgent } from "@/lib/llm/coach";
import { checkRateLimit } from "@/lib/llm/provider";
import { precheckInputOf } from "@/lib/projects";
import { buildDemoScript, buildExperimentCard, buildVisibleResultChecklist } from "@/lib/deliverables";

/** 提交预检:硬规则 + 四维Agent预检 + 三件套生成(不落快照,提交时才快照) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const { bundle, user } = access;

  if (!checkRateLimit(user.id)) return jsonError(429, "Agent 调用过于频繁,请一分钟后再试");

  const precheckInput = precheckInputOf(bundle);
  const hardRules = runHardRules(precheckInput);

  // 四维预检:无论硬规则是否通过都给出分数与缺口,帮助完善材料
  const agent = await runAgent({ bundle, step: 9, purpose: "PRECHECK" });

  const deliverableInput = {
    ...precheckInput,
    title: bundle.project.title,
    teamName: bundle.team.name,
    memberNames: bundle.members.map((m) => m.name),
  };

  return Response.json({
    ok: true,
    hardRules: hardRules.rules,
    canSubmit: hardRules.canSubmit,
    agent: { feedback: agent.feedback, status: agent.status, provider: agent.provider },
    deliverables: {
      experimentCard: buildExperimentCard(deliverableInput),
      visibleResultChecklist: buildVisibleResultChecklist(),
      demoScript: buildDemoScript(deliverableInput),
    },
  });
}
