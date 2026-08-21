"use client";

import { useLayoutEffect } from "react";
import { Wizard } from "@/components/wizard";
import type { WizardData } from "@/components/wizard-types";

/**
 * Compatibility boundary for the legacy Wizard.
 *
 * Wizard owns its step URL through history.replaceState(). The new project
 * surface uses `view=advanced` as an explicit, reversible mode switch, so this
 * wrapper preserves that semantic flag whenever the legacy surface updates the
 * current step. Removing it would make refresh/back navigation silently return
 * users to a different interface than the one they chose.
 */
export function AdvancedWizard({ data }: { data: WizardData }) {
  useLayoutEffect(() => {
    const originalReplaceState = window.history.replaceState;

    function preserveAdvancedView(
      this: History,
      state: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      if (url == null) {
        return originalReplaceState.call(this, state, unused, url);
      }

      const next = new URL(String(url), window.location.origin);
      if (next.pathname === `/projects/${data.projectId}`) {
        next.searchParams.set("view", "advanced");
        return originalReplaceState.call(
          this,
          state,
          unused,
          `${next.pathname}${next.search}${next.hash}`,
        );
      }
      return originalReplaceState.call(this, state, unused, url);
    }

    window.history.replaceState = preserveAdvancedView;

    const current = new URL(window.location.href);
    current.searchParams.set("view", "advanced");
    originalReplaceState.call(
      window.history,
      window.history.state,
      "",
      `${current.pathname}${current.search}${current.hash}`,
    );

    return () => {
      window.history.replaceState = originalReplaceState;
    };
  }, [data.projectId]);

  return <Wizard data={data} />;
}
