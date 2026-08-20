"use client";

import { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { TEST_TYPE_LABELS, VERDICT_LABELS } from "@/lib/constants";
import { validateTestCases } from "@/lib/validation";
import { Alert, Badge, Button, Input, Select, Textarea, cn } from "./ui";
import type { TestCaseRow, WizardData } from "./wizard-types";

const emptyCase = (): TestCaseRow => ({
  name: "",
  type: "NORMAL",
  input: "",
  expected: "",
  actual: "",
  verdict: "PENDING",
  manualFix: "",
  failureReason: "",
});

/** 判定结果对应的左侧色条:通过=青绿,失败=朱红,待填=墨线 */
const verdictBar: Record<TestCaseRow["verdict"], string> = {
  PASS: "border-l-emerald-400",
  FAIL: "border-l-red-400",
  NA: "border-l-ink-300",
  PENDING: "border-l-ink-900/15",
};

export function TestsStep({
  data,
  initialCases,
  readOnly,
  saveTests,
  setSave,
  onChange,
}: {
  data: WizardData;
  initialCases: TestCaseRow[];
  readOnly: boolean;
  saveTests: (cases: TestCaseRow[], strict: boolean) => Promise<{ ok: boolean; errors: { field: string; reason: string }[] }>;
  setSave: (s: { state: "idle" | "saving" | "saved" | "error"; savedAt: string }) => void;
  onChange?: (cases: TestCaseRow[]) => void;
}) {
  const [cases, setCases] = useState<TestCaseRow[]>(
    initialCases.length ? initialCases : [emptyCase(), emptyCase(), emptyCase()]
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const casesRef = useRef(cases);
  casesRef.current = cases;

  const errors = useMemo(() => validateTestCases(cases).errors, [cases]);
  const typeCount = (t: string) => cases.filter((c) => c.type === t).length;

  function update(i: number, patch: Partial<TestCaseRow>) {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    if (readOnly) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveTests(casesRef.current, false).then((r) => {
        if (r.ok && onChange) onChange(casesRef.current);
      });
    }, 1000);
  }

  function addCase() {
    setCases((prev) => [...prev, emptyCase()]);
  }

  function removeCase(i: number) {
    const next = casesRef.current.filter((_, idx) => idx !== i);
    setCases(next);
    if (timer.current) clearTimeout(timer.current);
    setTimeout(() => {
      saveTests(next, false).then((r) => {
        if (r.ok && onChange) onChange(next);
      });
    }, 50);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={cases.length >= 5 ? "green" : "gray"}>共{cases.length}例(需≥5)</Badge>
        <Badge tone={typeCount("NORMAL") >= 1 ? "green" : "amber"}>常规{typeCount("NORMAL")}</Badge>
        <Badge tone={typeCount("BOUNDARY") >= 1 ? "green" : "amber"}>边界/复杂{typeCount("BOUNDARY")}</Badge>
        <Badge tone={typeCount("FAILURE") + typeCount("NA") >= 1 ? "green" : "amber"}>
          失败/不适用{typeCount("FAILURE") + typeCount("NA")}
        </Badge>
        {readOnly && <Badge tone="gray">只读</Badge>}
      </div>

      {errors.length > 0 && (
        <Alert tone="warn" title="覆盖提示">
          <ul className="list-disc pl-4">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e.reason}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="space-y-3">
        {cases.map((c, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-ink-900/10 border-l-[3px] bg-[#fffdf8] p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-colors duration-200",
              verdictBar[c.verdict]
            )}
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="tnum flex h-6 w-6 items-center justify-center rounded-md bg-ink-100 text-[11px] font-bold text-ink-600" aria-hidden>
                {i + 1}
              </span>
              <Select
                className="w-32"
                disabled={readOnly}
                value={c.type}
                onChange={(e) => update(i, { type: e.target.value as TestCaseRow["type"] })}
              >
                {Object.entries(TEST_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
              <Input
                className="min-w-[140px] flex-1"
                disabled={readOnly}
                placeholder="案例名称,如:常规单条变更"
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Select
                className="w-32"
                disabled={readOnly}
                value={c.verdict}
                onChange={(e) => update(i, { verdict: e.target.value as TestCaseRow["verdict"] })}
              >
                {Object.entries(VERDICT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => removeCase(i)} title="删除该案例" aria-label="删除该案例">
                  <Trash2 size={14} strokeWidth={2} aria-hidden />
                </Button>
              )}
            </div>
            <div className="grid gap-2.5 md:grid-cols-2">
              <label className="block text-xs font-medium text-ink-500">
                输入 *
                <Textarea
                  className="mt-1 min-h-[64px]"
                  rows={2}
                  disabled={readOnly}
                  value={c.input}
                  onChange={(e) => update(i, { input: e.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-ink-500">
                预期 *
                <Textarea
                  className="mt-1 min-h-[64px]"
                  rows={2}
                  disabled={readOnly}
                  value={c.expected}
                  onChange={(e) => update(i, { expected: e.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-ink-500">
                实际
                <Textarea
                  className="mt-1 min-h-[64px]"
                  rows={2}
                  disabled={readOnly}
                  value={c.actual}
                  onChange={(e) => update(i, { actual: e.target.value })}
                />
              </label>
              <div className="grid content-start gap-2.5">
                <label className="block text-xs font-medium text-ink-500">
                  人工修改
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    value={c.manualFix}
                    onChange={(e) => update(i, { manualFix: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-ink-500">
                  失败原因(失败/不适用必填更佳)
                  <Input
                    className="mt-1"
                    disabled={readOnly}
                    value={c.failureReason}
                    onChange={(e) => update(i, { failureReason: e.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && <Button variant="secondary" size="sm" onClick={addCase}>+ 添加案例</Button>}
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              saveTests(cases, false).then((r) => {
                setSave({ state: "saved", savedAt: new Date().toLocaleTimeString("zh-CN") });
                if (r.ok && onChange) onChange(cases);
              })
            }
          >
            立即保存
          </Button>
        )}
        <span className="text-xs text-ink-400">表格自动保存;失败案例鼓励如实展示。</span>
      </div>
    </div>
  );
}
