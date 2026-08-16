import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `组织者 · ${site.title}`,
  description: `${site.brand.name}组织者说明：看见共性阻塞与资源需求，而不是窥探私人探索。`,
};

export default function OrganizerRolePage() {
  return <RolePage roleKey="organizer" />;
}
