// 种子数据:演示账号、活动配置、四赛道、Prompt v1、公告/灵感/Office Hour、演示项目
// 运行:npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TRACKS } from "../lib/constants";
import { COACH_SYSTEM_PROMPT, PRECHECK_SYSTEM_PROMPT } from "../lib/prompts";
import { buildDemoScript, buildExperimentCard } from "../lib/deliverables";
import { runHardRules } from "../lib/precheck";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

async function createTriggers() {
  // 队伍最多2人(数据库层兜底,前端与服务端之外的最后防线)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS team_size_guard
BEFORE INSERT ON TeamMember
BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM TeamMember WHERE teamId = NEW.teamId) >= 2
  THEN RAISE(ABORT, 'TEAM_FULL: 每队最多2名成员') END;
END;`);
  // 提交快照不可变
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS snapshot_no_update
BEFORE UPDATE ON SubmissionSnapshot
BEGIN SELECT RAISE(ABORT, 'SNAPSHOT_IMMUTABLE: 提交快照不可修改'); END;`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS snapshot_no_delete
BEFORE DELETE ON SubmissionSnapshot
BEGIN SELECT RAISE(ABORT, 'SNAPSHOT_IMMUTABLE: 提交快照不可删除'); END;`);
  // 评分锁定后不能修改
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS review_locked_guard
BEFORE UPDATE ON Review WHEN OLD.status = 'LOCKED'
BEGIN SELECT RAISE(ABORT, 'REVIEW_LOCKED: 评分已锁定'); END;`);
}

async function main() {
  await createTriggers();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const upsertUser = (id: string, email: string, name: string, role: string) =>
    prisma.user.upsert({ where: { email }, update: { role, name }, create: { id, email, name, role, passwordHash } });

  const admin = await upsertUser("u-admin", "admin@demo.com", "站点管理员", "ADMIN");
  const organizer = await upsertUser("u-organizer", "organizer@demo.com", "活动组织者", "ORGANIZER");
  const judge1 = await upsertUser("u-judge1", "judge1@demo.com", "评委一", "JUDGE");
  await upsertUser("u-judge2", "judge2@demo.com", "评委二", "JUDGE");
  const alice = await upsertUser("u-alice", "alice@demo.com", "小艾", "PARTICIPANT");
  const bob = await upsertUser("u-bob", "bob@demo.com", "小博", "PARTICIPANT");
  const carol = await upsertUser("u-carol", "carol@demo.com", "小卡", "PARTICIPANT");
  void admin;
  void judge1;

  await prisma.activityConfig.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      name: "青年AI轻创活动",
      slogan: "发现一个真问题,做一个可验证的解法。",
      intro:
        "不做宏大平台,只做一条从真问题到可验证解法的小实验路径:10步向导、5个测试案例、三项轻交付,四维40分评审。",
      startDate: "2026-08-15",
      endDate: "2026-10-15",
      submissionDeadline: "2026-10-10 18:00",
    },
  });

  for (const [i, t] of TRACKS.entries()) {
    const { key, ...rest } = t;
    await prisma.trackConfig.upsert({
      where: { id: key },
      update: { ...rest },
      create: { id: key, ...rest, sortOrder: i },
    });
  }

  await prisma.promptVersion.upsert({
    where: { version: "coach-v1" },
    update: { systemPrompt: COACH_SYSTEM_PROMPT },
    create: { version: "coach-v1", purpose: "COACH", systemPrompt: COACH_SYSTEM_PROMPT, active: true },
  });
  await prisma.promptVersion.upsert({
    where: { version: "precheck-v1" },
    update: { systemPrompt: PRECHECK_SYSTEM_PROMPT },
    create: { version: "precheck-v1", purpose: "PRECHECK", systemPrompt: PRECHECK_SYSTEM_PROMPT, active: true },
  });

  await prisma.announcement.createMany({
    data: [
      { title: "活动启动:先读规则,再选真问题", body: "请先完成第1步的规则与数据承诺。记住口号:发现一个真问题,做一个可验证的解法。提交前请自查:求证闭环五要素是否齐备、测试是否覆盖失败情况。", pinned: true },
      { title: "Office Hour 每周三晚开放", body: "组队、选题、判定标准有疑问,欢迎带问题来Office Hour,30分钟一对一小范围交流。" },
    ],
  });

  await prisma.inspirationCase.createMany({
    data: [
      { title: "评审材料差异对比助手", track: "process-automation", summary: "把两个系统的导出记录自动整理成一页对比说明,人工确认后发出,准备时间从40分钟降到10分钟。", tags: "表格,对比,人工确认" },
      { title: "部门规章问答小助手", track: "knowledge-qa", summary: "基于公开规章文件构建问答,回答必须附出处,不确定就明说不知道,新人查询不用再翻三个文档。", tags: "知识库,溯源" },
      { title: "周报草稿生成器", track: "personal-efficiency", summary: "把散落的聊天记录和文档自动汇总成周报草稿,本人确认修改后发出,每周节省约1小时。", tags: "周报,汇总" },
      { title: "日志异常初筛Agent", track: "engineering-agent", summary: "对提交的日志做异常初筛并归类,工程师复核结论后才进入处理流程,初筛不替代工程判断。", tags: "日志,初筛,复核" },
    ],
  });

  await prisma.officeHour.createMany({
    data: [
      { title: "选题门诊:你的问题够真吗", host: "组织者+往届参与者", time: "每周三 19:30—21:00", place: "线上会议(报名后发送链接)", capacity: 20 },
      { title: "测试案例工作坊:怎么设计失败案例", host: "评委代表", time: "每周五 19:30—20:30", place: "线上会议(报名后发送链接)", capacity: 15 },
    ],
  });

  // ---------- 演示项目1:alice 单人队,已完整走完并提交 ----------
  const demoTeam = await prisma.team.findFirst({ where: { name: "艾的实验小队" } });
  if (!demoTeam) {
    const team = await prisma.team.create({
      data: {
        name: "艾的实验小队",
        inviteCode: "A1B2C3D4",
        mode: "SOLO",
        startTime: "2026-08-20 起,工作日晚间与周末",
        existingBase: "无,活动期间从零开始",
        addedDuringActivity: "提示词、对齐脚本、5个测试案例、小实验卡与全部文档",
        externalResources: "GLM API、WorkBuddy、开源CSV解析库",
        helpers: "无",
      },
    });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: alice.id, seatRole: "OWNER" } });

    const project = await prisma.ideaProject.create({
      data: {
        teamId: team.id,
        title: "变更对比说明小助手",
        track: "process-automation",
        status: "SUBMITTED",
        currentStep: 10,
        submittedAt: new Date(),
      },
    });

    const stage = (step: number, data: Record<string, unknown>) =>
      prisma.stageResponse.create({ data: { projectId: project.id, step, data: JSON.stringify(data) } });

    await stage(1, { agreeRules: true, agreeDataSafety: true, agreeOriginality: true });
    await stage(4, {
      targetUser: "本部门新入职的结构设计工程师",
      scenario: "每次评审前要把两个系统的变更记录手动拼成一份对比说明",
      frequency: "每周2—3次,每次约40分钟",
      currentProcess: "打开系统A导出CSV→复制到表格→打开系统B核对→手工排版成说明",
      worstStep: "两个系统字段名不一致,人工对错行后整段返工",
      currentCost: "每周约2小时,且每月约1次错漏",
      whyWorth: "节省的时间可用于复核关键变更,错漏直接影响评审质量",
    });
    await stage(5, {
      usableResult: "生成的对比说明无事实错误,人工10分钟内可确认发出",
      unacceptableErrors: "变更条目遗漏、日期或责任人有错",
      judgmentSource: "以两个系统导出的原始记录为准,字段对照表固定版本",
      inputInfo: "两份已脱敏的CSV导出样例",
      outputFormat: "一页Markdown对比说明",
      stopConditions: "数据行数对不上、关键字段缺失、疑似包含非公开信息",
      initialTestCases: "①常规单条变更 ②同日多条变更 ③导出为空 ④字段对照缺失 ⑤含疑似敏感内容",
    });
    await stage(6, {
      oneSentenceMvp: "把两份导出记录自动整理成一页人工可确认的对比说明",
      coreUser: "我自己(新入职结构设计工程师)",
      coreProblem: "评审前手工拼对比说明耗时且易错",
      coreLoop: "两份CSV输入→脚本自动对齐合并→按字段对照表自动检查→人工逐条确认→输出说明",
      verifiableMetric: "单次准备时间从40分钟降到10分钟以内",
      aiResponsibility: "字段对齐、格式整理、差异高亮草稿",
      humanResponsibility: "核对差异结论、确认放行、处理异常",
      autoCheckScope: "条目数量一致、日期格式合法、责任人字段非空",
      humanConfirmPoint: "发出前逐条确认差异项",
      finalOwner: "我本人(单人队)",
      tools: "GLM API + Python脚本 + 表格软件",
      notDoing: "不做多系统直连、不做自动发送、不做移动端",
    });

    await prisma.testCase.createMany({
      data: [
        { projectId: project.id, sortOrder: 1, name: "常规单条变更", type: "NORMAL", input: "系统A1条+系统B1条,字段完整", expected: "输出1行对比,无差异提示", actual: "输出1行,与手工结果一致", verdict: "PASS", manualFix: "", failureReason: "" },
        { projectId: project.id, sortOrder: 2, name: "同日多条变更", type: "BOUNDARY", input: "同日5条变更,顺序不同", expected: "全部对齐,不丢条目", actual: "5条对齐,顺序按时间排序", verdict: "PASS", manualFix: "", failureReason: "" },
        { projectId: project.id, sortOrder: 3, name: "导出为空", type: "FAILURE", input: "系统B导出为空文件", expected: "停止并提示人工检查,不输出半成品", actual: "首次运行输出了半成品", verdict: "FAIL", manualFix: "增加空文件停止条件,转人工确认后重跑", failureReason: "未对空输入设停止条件,违反异常处理要求" },
        { projectId: project.id, sortOrder: 4, name: "字段对照缺失", type: "BOUNDARY", input: "新字段无对照关系", expected: "标红提示,不猜测映射", actual: "标红并列出未映射字段", verdict: "PASS", manualFix: "", failureReason: "" },
        { projectId: project.id, sortOrder: 5, name: "含疑似敏感内容", type: "NA", input: "样例含人名与工号(未脱敏)", expected: "不适用:直接停止,提示先脱敏", actual: "停止并提示脱敏后重试", verdict: "NA", manualFix: "改用脱敏样例完成其余测试", failureReason: "活动红线禁止处理未脱敏个人信息" },
      ],
    });

    // 生成提交快照
    const bundle = await prisma.ideaProject.findUniqueOrThrow({
      where: { id: project.id },
      include: { team: { include: { members: { include: { user: true } } } }, stages: true, testCases: true },
    });
    const precheckInput = {
      team: {
        memberCount: bundle.team.members.length,
        startTime: bundle.team.startTime,
        existingBase: bundle.team.existingBase,
        addedDuringActivity: bundle.team.addedDuringActivity,
        externalResources: bundle.team.externalResources,
        helpers: bundle.team.helpers,
      },
      stages: bundle.stages.map((s) => ({ step: s.step, data: s.data })),
      track: bundle.track,
      testCases: bundle.testCases,
    };
    const deliverableInput = {
      ...precheckInput,
      title: bundle.title,
      teamName: bundle.team.name,
      memberNames: bundle.team.members.map((m) => m.user.name),
    };
    const payload = {
      project: { id: bundle.id, title: bundle.title, track: bundle.track, submittedAt: bundle.submittedAt },
      team: bundle.team,
      stages: bundle.stages,
      testCases: bundle.testCases,
      hardRules: runHardRules(precheckInput),
      experimentCard: buildExperimentCard(deliverableInput),
      demoScript: buildDemoScript(deliverableInput),
    };
    await prisma.submissionSnapshot.create({
      data: { projectId: project.id, version: 1, payload: JSON.stringify(payload) },
    });

    // 评委分配(预赛)
    await prisma.reviewAssignment.create({
      data: { projectId: project.id, judgeId: judge1.id, round: "PRELIMINARY" },
    });
  }

  // ---------- 演示项目2:bob+carol 双人队,草稿进行到第4步 ----------
  const duoTeam = await prisma.team.findFirst({ where: { name: "问答双子" } });
  if (!duoTeam) {
    const team = await prisma.team.create({
      data: {
        name: "问答双子",
        inviteCode: "E5F6G7H8",
        mode: "DUO",
        startTime: "2026-08-22 起,每周两个晚上",
        existingBase: "收集过一批公开规章文档",
        addedDuringActivity: "知识库整理脚本、问答提示词、测试案例",
        externalResources: "GLM API、开源文档解析库",
        helpers: "同事提供过一次文档口径咨询(非核心工作)",
      },
    });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: bob.id, seatRole: "ECHO" } });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: carol.id, seatRole: "DELTA" } });

    const project = await prisma.ideaProject.create({
      data: { teamId: team.id, title: "部门规章问答小助手", track: "knowledge-qa", status: "DRAFT", currentStep: 4 },
    });
    await prisma.stageResponse.create({
      data: { projectId: project.id, step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) },
    });
    await prisma.stageResponse.create({
      data: {
        projectId: project.id,
        step: 4,
        data: JSON.stringify({
          targetUser: "新入职员工",
          scenario: "查一条报销规定要在三个文档间来回翻找",
          frequency: "每周约3次,每次10分钟",
          currentProcess: "打开制度库→搜索关键词→人工比对版本→截图存档",
          worstStep: "两个文档说法略有出入,不知道以哪个为准",
          currentCost: "每周约30分钟,偶尔按旧版本执行",
          whyWorth: "统一出口能减少误用旧规定的风险",
        }),
      },
    });
  }

  void organizer;

  console.log("种子数据完成。演示账号密码均为:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
