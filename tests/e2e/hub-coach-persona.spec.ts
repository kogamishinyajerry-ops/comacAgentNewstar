import { expect, test, type Page } from "@playwright/test";
import { beginCoach } from "./helpers";
import { coachDemoActs } from "../../fixtures/coach-demo";

/**
 * K3 本轮:Coach 人格与三幕减法的行为验收(任务书§四状态 A–D、§七)。
 * 表达以下失败模式:
 * - 种子前完整左右栏仍存在;
 * - 第二、三幕完整历史问答仍可见;
 * - 当前判断/最大风险与主问题长期并列;
 * - 判断/风险不是时间序列而是同屏卡片;
 * - 种子焦点被滚出可视区域;
 * - aria-live 与焦点元素重复朗读同一内容;
 * - reduced-motion 下流程或焦点顺序改变;
 * - 375×812 / 1280×800 视口回归。
 *
 * 截图证据写入 docs/audit/shots-k3-persona/(任务书§九.5)。
 */

const SHOTS = "docs/audit/shots-k3-persona";

const QUESTIONS = [
  "你最想改变的具体工作瞬间是什么?",
  "这个问题对谁造成了什么具体损失?",
  "为什么普通大模型聊天不足以解决它?",
] as const;

const ANSWERS = [
  "试验异常记录、依据和处理结果分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

async function submit(page: Page, answer: string) {
  await page.locator("#coach-answer").fill(answer);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
}

/** 走完整幕间时序,直到指定幕的问题成为唯一焦点 */
async function answerUntilQuestion(page: Page, actIndex: number, fromIndex = 0) {
  for (let i = fromIndex; i < actIndex; i++) {
    await expect(page.getByRole("heading", { name: QUESTIONS[i] })).toBeVisible();
    await submit(page, ANSWERS[i]);
    await expect(page.getByRole("heading", { name: QUESTIONS[i + 1] })).toBeVisible({
      timeout: 15_000,
    });
  }
}

test.describe("状态 A:种子前的减法布局(桌面 1440×900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("种子前不存在完整左右栏,只保留单一主问题场景", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);

    // 失败模式:完整左侧工作台栏与右侧 insight 栏仍存在
    // 幽灵断言清理(§21):rail/insight/stage-list 类已随源码删除,不再保留永绿断言;
    // 种子前 Artifact 栏不出现仍是有效防线
    await expect(page.locator(".coach-artifact-rail")).toHaveCount(0);

    // 保留的七个元素:极弱返回、幕号、Coach 状态提示、主问题、回答器、附件按钮、主提交
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toBeVisible();
    await expect(page.getByText("01 / 03")).toBeVisible();
    // begin 后焦点接续到回答器(§31 J-1),状态提示由"静候"转为"倾听",均为合法首幕态
    await expect(page.getByText(/AI Coach · (静候|倾听)/)).toBeVisible();
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    await expect(page.locator("#coach-answer")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /添加文本附件/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "提交这一问的回答" })).toHaveCount(1);

    // B2 浮屿:旧常驻 composer 小字与附件 Chip/按需确认默认不出现;
    // 隐私披露改为前置(§18):第1、2幕问题态常驻,先于输入告知外发事实
    await expect(page.locator(".coach-composer-note")).toHaveCount(0);
    await expect(page.locator("[data-coach-privacy-note]")).toHaveCount(1);
    await expect(page.locator("[data-coach-privacy-note]")).toHaveText(
      "回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。"
    );
    await expect(page.locator(".coach-attachment-chip")).toHaveCount(0);
    await expect(page.locator("#coach-attachment-note")).toHaveCount(0);

    // 任一时刻只有一个语义主标题,且就是当前主问题
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(QUESTIONS[0]);

    // 常驻“真实问题/已有想法”切换栏退场,只留一个弱化换入口动作
    await expect(page.getByRole("link", { name: "真实问题", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "已有想法", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /换一条入口/ })).toHaveCount(1);

    await page.screenshot({ path: `${SHOTS}/state-a-question-1440.png` });
  });

  test("隐私披露时序:第1、2幕问题态常驻,过渡期与第3幕不出现", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();

    // 第1幕问题态:披露在场(该幕提交将发送至 AI 服务)
    await expect(page.locator("[data-coach-privacy-note]")).toHaveCount(1);

    await submit(page, ANSWERS[0]);
    // 过渡期:回答器折叠即过渡态标志,披露随之退场
    await expect(page.locator("#coach-answer")).toHaveCount(0);
    await expect(page.locator("[data-coach-privacy-note]")).toHaveCount(0);

    // 第2幕问题态:该幕提交仍会外发,披露再次出现
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-coach-privacy-note]")).toHaveCount(1);

    // 第3幕:回答只在本页凝结种子,不再外发,披露不出现
    await submit(page, ANSWERS[1]);
    await expect(page.getByRole("heading", { name: QUESTIONS[2] })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-coach-privacy-note]")).toHaveCount(0);
  });
});

test.describe("状态 B:提交后的判断→风险→下一问时序", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("判断与风险依次单独出现,不与下一问长期并列", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    await page.locator("#coach-answer").fill(ANSWERS[0]);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();

    // 第一拍:当前判断单独出现,最大风险尚未出现
    const judgmentStep = page.locator('[data-transition-step="judgment"]');
    await expect(judgmentStep).toBeVisible({ timeout: 15_000 });
    await expect(judgmentStep.getByText("当前判断")).toBeVisible();
    /* P1-1(§31 H6,⚑D2):mock 链路落屏的是口径校准后的业务专家话术 */
    await expect(judgmentStep).toContainText(coachDemoActs.problem[1].judgment);
    await expect(page.locator('[data-transition-step="risk"]')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/state-b-judgment-1440.png` });

    // 第二拍:最大风险单独出现,判断已退出
    const riskStep = page.locator('[data-transition-step="risk"]');
    await expect(riskStep).toBeVisible({ timeout: 15_000 });
    await expect(riskStep.getByText("最大风险")).toBeVisible();
    await expect(riskStep).toContainText(coachDemoActs.problem[1].risk);
    await expect(page.locator('[data-transition-step="judgment"]')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/state-b-risk-1440.png` });

    // 第三拍:下一问成为唯一焦点,判断/风险均退出,不长期同屏
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-transition-step]")).toHaveCount(0);
    await expect(page.getByText("当前判断")).toHaveCount(0);
    await expect(page.getByText("最大风险")).toHaveCount(0);
  });

  test("aria-live 不与焦点元素重复朗读同一内容", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await answerUntilQuestion(page, 1);

    const liveText = (await page.locator('p[aria-live="polite"]').textContent()) ?? "";
    const questionText = (await page.locator("#coach-question").textContent()) ?? "";
    expect(questionText.length).toBeGreaterThan(0);
    // 失败模式:aria-live 复述焦点回答器已由 label 朗读的同一问题
    expect(liveText).not.toContain(questionText);
  });

  test("reduced-motion 下时序与焦点结果一致,直接切换无动画", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/start");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    await page.locator("#coach-answer").fill(ANSWERS[0]);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();

    const judgmentStep = page.locator('[data-transition-step="judgment"]');
    await expect(judgmentStep).toBeVisible({ timeout: 15_000 });
    // 焦点落在判断步骤文本上,不掉 body;且动画被禁用
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-step-kind")))
      .toBe("judgment");
    const animationName = await judgmentStep.evaluate(
      (el) => getComputedStyle(el).animationName
    );
    expect(animationName).toBe("none");

    const riskStep = page.locator('[data-transition-step="risk"]');
    await expect(riskStep).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-step-kind")))
      .toBe("risk");

    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    // 时序结束后焦点接续到新一幕的回答器(与正常动效一致)
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 15_000 })
      .toBe("coach-answer");
  });
});

test.describe("状态 C:后续幕的历史压缩轨迹", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("第二幕起完整历史问答默认不可见,只保留一行结论轨迹", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await answerUntilQuestion(page, 1);

    // 失败模式:第一幕完整问答气泡仍可见
    await expect(page.getByText(ANSWERS[0])).toHaveCount(0);
    await expect(page.locator(".coach-message--user")).toHaveCount(0);
    await expect(page.locator(".coach-message--coach")).toHaveCount(0);

    // 打磨轮⑥(§29):回答沉淀到常驻问题卡第一格(20 字摘录),完整回答不可见
    const momentSlot = page.locator('[data-coach-slot="moment"]');
    await expect(momentSlot).toHaveAttribute("data-coach-slot-filled", "true");
    expect((await momentSlot.textContent()) ?? "").not.toContain(ANSWERS[0]);
    await expect(page.locator('[data-coach-slot="impact"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "false",
    );

    // 第三幕:两格已沉淀,当前问题仍占据视觉中心
    await submit(page, ANSWERS[1]);
    await expect(page.getByRole("heading", { name: QUESTIONS[2] })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-coach-slot="impact"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
    await expect(page.getByText(ANSWERS[1])).toHaveCount(0);
    await expect(page.locator("h1")).toHaveText(QUESTIONS[2]);
    await page.screenshot({ path: `${SHOTS}/state-c-traces-1440.png` });
  });
});

test.describe("状态 D:问题种子与工作空间长出", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("种子后才长出 Artifacts 与 主张—证据—缺口,焦点留在可视区域", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    // 种子前:Artifacts 不存在
    await expect(page.locator(".coach-artifact-rail")).toHaveCount(0);
    await answerUntilQuestion(page, 2);
    await submit(page, ANSWERS[2]);

    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });

    // 长出:Artifacts 图标入口 + 主张—证据—缺口 + 一个主 CTA + 弱化重开
    await expect(page.locator(".coach-artifact-rail")).toBeVisible();
    await expect(page.locator("[data-coach-artifact]")).toHaveCount(4);
    await expect(page.locator("[data-seed-claim]")).toBeVisible();
    await expect(page.locator("[data-seed-evidence]")).toBeVisible();
    await expect(page.locator("[data-seed-gaps]")).toBeVisible();
    await expect(page.getByRole("link", { name: "了解完整实践路径" })).toBeVisible();
    await expect(page.getByRole("button", { name: /重新开始|换一条入口重新体验/ })).toBeVisible();

    // 缺口诚实标注,不暗示已完成验证
    await expect(page.getByText("仍待深挖(诚实标注)")).toBeVisible();
    const body = await page.textContent("body");
    // 副标题“不是项目创建成功”是合法的否定表达,只禁伪完成指标
    for (const banned of ["健康分", "完成率", "排行榜"]) {
      expect(body).not.toContain(banned);
    }

    // 焦点落在种子标题且仍在可视区域,不被滚出
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 15_000 })
      .toBe("workbench-coach-seed-title");
    const geometry = await page.evaluate(() => {
      const focused = document.activeElement?.getBoundingClientRect();
      const scroller = document
        .querySelector("[data-coach-conversation-scroll]")
        ?.getBoundingClientRect();
      if (!focused || !scroller) return null;
      return {
        focusedTop: focused.top,
        focusedBottom: focused.bottom,
        scrollerTop: scroller.top,
        scrollerBottom: scroller.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry!.focusedTop).toBeGreaterThanOrEqual(geometry!.scrollerTop - 1);
    expect(geometry!.focusedBottom).toBeLessThanOrEqual(geometry!.scrollerBottom + 1);
    expect(geometry!.focusedBottom).toBeLessThanOrEqual(geometry!.viewportHeight + 1);

    await page.screenshot({ path: `${SHOTS}/state-d-seed-1440.png` });
  });
});

test.describe("移动端 375×812 与桌面 1280×800 视口", () => {
  test("375×812:单一主焦点、无横向溢出、主提交热区达标", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    // 建立拍同样满足固定视口宪法:零横向溢出且一屏放得下
    const introMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(introMetrics.overflow).toBeLessThanOrEqual(0);
    expect(introMetrics.documentHeight).toBeLessThanOrEqual(introMetrics.viewportHeight + 1);
    await beginCoach(page);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll("button")).find((b) =>
        b.getAttribute("aria-label")?.includes("提交")
      );
      const composer = document.querySelector(".coach-composer");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        submitHeight: submit?.getBoundingClientRect().height ?? 0,
        composerBottom: composer?.getBoundingClientRect().bottom ?? Infinity,
      };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.submitHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    await page.screenshot({ path: `${SHOTS}/state-a-question-375.png` });
  });

  test("375×812:幕间时序后仍无溢出,轨迹不挤压当前问题", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await beginCoach(page);
    await answerUntilQuestion(page, 1);
    await expect(page.locator('[data-coach-slot="moment"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await answerUntilQuestion(page, 2, 1);
    await submit(page, ANSWERS[2]);
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/state-d-seed-375.png` });
  });

  test("1280×800:减法布局无溢出且回答器可见", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const composer = document.querySelector(".coach-composer");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        composerBottom: composer?.getBoundingClientRect().bottom ?? Infinity,
      };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    await page.screenshot({ path: `${SHOTS}/state-a-question-1280.png` });
  });
});

test.describe("移动端 390×844 四状态截图证据", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("状态 B/C/D 移动端形态与时序一致", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    await page.locator("#coach-answer").fill(ANSWERS[0]);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();

    // 状态 B 移动端:判断单独出现,风险未并列
    const judgmentStep = page.locator('[data-transition-step="judgment"]');
    await expect(judgmentStep).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-transition-step="risk"]')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/state-b-judgment-390.png` });

    // 状态 C 移动端:轨迹压缩,完整回答不可见
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(ANSWERS[0])).toHaveCount(0);
    await expect(page.locator('[data-coach-slot="moment"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
    await page.screenshot({ path: `${SHOTS}/state-c-traces-390.png` });

    // 状态 D 移动端:种子长出,无横向溢出
    await answerUntilQuestion(page, 2, 1);
    await submit(page, ANSWERS[2]);
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".coach-artifact-rail")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/state-d-seed-390.png` });
  });
});
