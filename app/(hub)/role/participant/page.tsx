import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";

export const metadata: Metadata = {
  title: "参赛者 · COMAC 青年 AI Agent 创新实践月",
  description: "找到值得做的问题,并把它变成有证据的作品。",
};

export default function ParticipantRolePage() {
  return <RolePage roleKey="participant" />;
}
