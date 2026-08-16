import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";

export const metadata: Metadata = {
  title: "组织者 · COMAC 青年 AI Agent 创新实践月",
  description: "看见共性阻塞与资源需求,而不是窥探私人探索。",
};

export default function OrganizerRolePage() {
  return <RolePage roleKey="organizer" />;
}
