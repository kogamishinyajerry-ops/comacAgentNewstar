"use client";

import { useMemo, useRef, useState } from "react";
import { TEST_TYPE_LABELS, VERDICT_LABELS } from "@/lib/constants";
import { validateTestCases } from "@/lib/validation";
import { Alert, Badge, Button, Input, Select } from "./ui";
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
          <div key={i} className="rounded-md border border-slate-200 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">案例{i + 1}</span>
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
                className="flex-1"
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
                <Button variant="ghost" size="sm" onClick={() => removeCase(i)} title="删除该案例">
                  ✕
                </Button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-500">
                输入 *
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={2}
                  disabled={readOnly}
                  value={c.input}
                  onChange={(e) => update(i, { input: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                预期 *
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={2}
                  disabled={readOnly}
                  value={c.expected}
                  onChange={(e) => update(i, { expected: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                实际
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={2}
                  disabled={readOnly}
                  value={c.actual}
                  onChange={(e) => update(i, { actual: e.target.value })}
                />
              </label>
              <div className="grid gap-2">
                <label className="text-xs text-slate-500">
                  人工修改
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    disabled={readOnly}
                    value={c.manualFix}
                    onChange={(e) => update(i, { manualFix: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  失败原因(失败/不适用必填更佳)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
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

      <div className="flex items-center gap-2">
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
        <span className="text-xs text-slate-400">表格自动保存;失败案例鼓励如实展示。</span>
      </div>
    </div>
  );
}
