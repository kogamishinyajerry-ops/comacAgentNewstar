import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";

export const metadata: Metadata = {
  title: "评委 · COMAC 青年 AI Agent 创新实践月",
  description: "先独立理解项目与证据,再做人的判断。",
};

export default function ReviewerRolePage() {
  return <RolePage roleKey="reviewer" />;
}
