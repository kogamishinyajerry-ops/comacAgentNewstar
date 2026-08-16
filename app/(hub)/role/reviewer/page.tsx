import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `评委 · ${site.title}`,
  description: `${site.brand.name}评委说明：先独立理解项目与证据，再做人的判断。`,
};

export default function ReviewerRolePage() {
  return <RolePage roleKey="reviewer" />;
}
