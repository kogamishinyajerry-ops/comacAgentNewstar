import { describe, expect, it } from "vitest";
import {
  COACH_ATTACHMENT_ACCEPT,
  COACH_ATTACHMENT_EXTENSIONS,
  COACH_ATTACHMENT_MAX_BYTES,
  coachAttachmentSchema,
  formatCoachAttachmentSize,
  hasCoachAttachmentExtension,
  validateCoachAttachment,
} from "../lib/hub/coach-attachment";

describe("hub Coach 附件契约:扩展名与 accept", () => {
  it("只允许 .txt / .md / .csv / .json，且大小写不敏感", () => {
    expect(COACH_ATTACHMENT_EXTENSIONS).toEqual([".txt", ".md", ".csv", ".json"]);
    for (const name of ["notes.txt", "记录.MD", "data.Csv", "导出.JSON", "  spaced.txt  "]) {
      expect(hasCoachAttachmentExtension(name)).toBe(true);
    }
    for (const name of ["evil.exe", "archive.txt.zip", "noext", "", "fake.txt.exe"]) {
      expect(hasCoachAttachmentExtension(name)).toBe(false);
    }
  });

  it("accept 字符串与扩展名清单同源", () => {
    expect(COACH_ATTACHMENT_ACCEPT).toBe(".txt,.md,.csv,.json");
    expect(COACH_ATTACHMENT_ACCEPT).toBe(COACH_ATTACHMENT_EXTENSIONS.join(","));
  });
});

describe("hub Coach 附件契约:客户端行内校验", () => {
  const valid = { name: "现场记录.md", size: 96, content: "一次试验异常的时间线。" };

  it("合法附件返回 null", () => {
    expect(validateCoachAttachment(valid)).toBeNull();
  });

  it("不支持的类型、空文件与超限各有对应文案", () => {
    expect(validateCoachAttachment({ ...valid, name: "payload.exe" })).toContain(
      "仅支持 .txt / .md / .csv / .json"
    );
    expect(validateCoachAttachment({ ...valid, size: 0 })).toContain("内容为空");
    expect(validateCoachAttachment({ ...valid, content: "   \n  " })).toContain("内容为空");
    expect(
      validateCoachAttachment({ ...valid, size: COACH_ATTACHMENT_MAX_BYTES + 1 })
    ).toContain("超过 1MB");
  });
});

describe("hub Coach 附件契约:大小显示", () => {
  it("按 B / KB / MB 三档紧凑显示，非法输入归零", () => {
    expect(formatCoachAttachmentSize(0)).toBe("0 B");
    expect(formatCoachAttachmentSize(512)).toBe("512 B");
    expect(formatCoachAttachmentSize(1024)).toBe("1 KB");
    expect(formatCoachAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatCoachAttachmentSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatCoachAttachmentSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatCoachAttachmentSize(-1)).toBe("0 B");
    expect(formatCoachAttachmentSize(Number.NaN)).toBe("0 B");
  });
});

describe("hub Coach 附件契约:服务端 zod schema", () => {
  const valid = { name: "notes.txt", size: 12, content: "一些真实的文本内容。" };

  it("接受合法附件并保留原值", () => {
    expect(coachAttachmentSchema.safeParse(valid).success).toBe(true);
  });

  it("strict:多余字段整体拒绝", () => {
    const result = coachAttachmentSchema.safeParse({ ...valid, unexpected: true });
    expect(result.success).toBe(false);
  });

  it("拒绝空内容与纯空白内容", () => {
    expect(coachAttachmentSchema.safeParse({ ...valid, content: "" }).success).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, content: "   \n\t " }).success).toBe(false);
  });

  it("拒绝声明大小或内容字符数超限", () => {
    expect(
      coachAttachmentSchema.safeParse({ ...valid, size: COACH_ATTACHMENT_MAX_BYTES + 1 }).success
    ).toBe(false);
    expect(
      coachAttachmentSchema.safeParse({ ...valid, size: 1, content: "x".repeat(COACH_ATTACHMENT_MAX_BYTES + 1) })
        .success
    ).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, size: 0 }).success).toBe(false);
  });

  it("拒绝坏类型与不支持的扩展名", () => {
    expect(coachAttachmentSchema.safeParse({ ...valid, content: 123 }).success).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, size: "12" }).success).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, name: 42 }).success).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, name: "evil.exe" }).success).toBe(false);
    expect(coachAttachmentSchema.safeParse({ ...valid, name: "x".repeat(201) + ".txt" }).success).toBe(
      false
    );
  });
});
