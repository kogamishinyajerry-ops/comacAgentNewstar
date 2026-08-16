import type { Metadata } from "next";
import { RolePage } from "@/components/hub/role-page";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `参赛者 · ${site.title}`,
  description: `${site.brand.name}参赛者说明：找到值得做的问题，并把它变成有证据的作品。`,
};

export default function ParticipantRolePage() {
  return <RolePage roleKey="participant" />;
}
