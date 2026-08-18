import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Composer 图标来源契约:只使用 lucide-react 的 Paperclip / ArrowUp / X,
 * 不再维护本地手工复制的 SVG path 组件(coach-icons.tsx 已删除)。
 */
const root = process.cwd();

describe("Composer 图标来源", () => {
  it("本地手写 SVG 图标组件已删除,场景直接使用 lucide-react", () => {
    expect(existsSync(join(root, "components/hub/coach-icons.tsx"))).toBe(false);

    const scene = readFileSync(join(root, "components/hub/coach-workspace-scene.tsx"), "utf8");
    const importLine = scene.split("\n").find((line) => line.includes('from "lucide-react"'));
    expect(importLine).toBeTruthy();
    for (const name of ["Paperclip", "ArrowUp", "X"]) {
      expect(importLine).toContain(name);
    }
    expect(scene).not.toMatch(/coach-icons/);
    expect(scene).not.toMatch(/<svg/);
    expect(scene).not.toMatch(/<path /);
  });

  it("lucide-react 是唯一新增的图标依赖", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies["lucide-react"]).toBeTruthy();
    // 不引入第二个图标库
    const iconLibs = Object.keys(manifest.dependencies).filter((name) =>
      /icon|lucide|heroicon|fontawesome|tabler/i.test(name)
    );
    expect(iconLibs).toEqual(["lucide-react"]);
  });
});
