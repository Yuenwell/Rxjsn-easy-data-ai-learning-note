/* Example course navigation and cohort schedule. Customize for your own course; no learner progress is bundled. */
(function (root) {
  'use strict';
  const base = 'https://datawhalechina.github.io/easy-data-x-ai/';
  const page = (folder, filename) => encodeURI(base + folder + '/' + filename + '.html');
  const chapters = {
    ENV: { title: '环境准备与课程导航', track: '基础', url: base + 'faq.html' },
    F0: { title: '课前闲聊与导读', track: '基础', url: page('base_knowledge', 'F0 课程稿：课前闲聊 —— OpenClaw 为什么越用越好用？') },
    F1: { title: '大模型的本质与边界', track: '基础', url: page('base_knowledge', 'F1 课程稿：AI 必知必会（一） —— 大模型的本质与边界') },
    F2: { title: 'AI Agent 全景图', track: '基础', url: page('base_knowledge', 'F2 课程稿：AI 必知必会（二） —— AI Agent 全景图') },
    P1: { title: 'AI Agent 场景识别', track: '产品', url: page('pm', 'P1 课程稿：AI Agent 场景识别') },
    P2: { title: 'Agentic RAG 产品设计', track: '产品', url: page('pm', 'P2 课程稿：Agentic RAG 产品设计') },
    P3: { title: 'Agent 记忆系统设计', track: '产品', url: page('pm', 'P3 课程稿：Agent 记忆系统设计') },
    P4: { title: 'Skill 与 Agent 知识管理', track: '产品', url: page('pm', 'P4 课程稿：Skill 与 Agent 知识管理') },
    P5: { title: '综合案例与度量', track: '产品', url: page('pm', 'P5 课程稿：综合案例与度量') },
    D1: { title: '大模型 API 基础', track: '开发', url: page('dev', 'D1 课程稿：大模型 API 工程化基础') },
    D2: { title: 'AI 应用的数据层', track: '开发', url: page('dev', 'D2 课程稿：AI 应用的数据层') },
    D3: { title: 'Agentic RAG 实战', track: '开发', url: page('dev', 'D3 课程稿：Agentic RAG 实战') },
    D4: { title: 'Agent 开发与记忆系统', track: '开发', url: page('dev', 'D4 课程稿：Agent 开发与记忆系统') },
    D5: { title: '课程总结', track: '开发', url: page('dev', 'D5 课程稿：课程总结') },
    I1: { title: 'AI 原生数据库基础', track: '产业', url: page('industry', 'I1 课程稿：AI 原生数据库基础') },
    I2: { title: '向量数据库与 RAG', track: '产业', url: page('industry', 'I2 课程稿：向量数据库与 RAG') },
    I3: { title: 'SQL × AI：AI Functions 的设计与执行', track: '产业', url: page('industry', 'I3 课程稿：SQL × AI —— AI Functions 的设计与执行') },
    I4: { title: 'File SQL for AI Agent', track: '产业', url: page('industry', 'I4 课程稿：File SQL for AI Agent') },
    I5: { title: 'AI 列：模型驱动派生数据的自动维护', track: '产业', url: page('industry', 'I5 课程稿：AI 列 —— 模型驱动派生数据的自动维护') },
    I6: { title: '上下文工程概述', track: '产业', url: page('industry', 'I6 课程稿：上下文工程概述') },
    I7: { title: 'PowerContext 的设计与实现', track: '产业', url: page('industry', 'I7 课程稿：PowerContext 的设计与实现') },
    I8: { title: '案例场景和测评构建', track: '产业', url: page('industry', 'I8 课程稿：案例场景和测评构建') }
  };
  const tasks = [
    { id: 'task1', number: 1, title: '环境准备与课前导读', days: 2, deadline: '2026-11-18T03:00:00+08:00', chapters: ['ENV', 'F0', 'F1', 'F2'], description: '完成环境准备与课前导读，用自己的话记录本次收获。', note: '本示例将环境准备与基础导读拆成 ENV、F0、F1、F2 四个辅助学习项。实际学习和打卡要求以所参加课程的通知为准。' },
    { id: 'task2', number: 2, title: '认识场景，打通模型调用', days: 3, deadline: '2026-11-21T03:00:00+08:00', chapters: ['P1', 'D1', 'I1'], description: '从场景判断走到 API 与工具调用，理解 AI 应用的数据需求。' },
    { id: 'task3', number: 3, title: '理解 RAG 与向量检索', days: 3, deadline: '2026-11-24T03:00:00+08:00', chapters: ['P2', 'I2'], description: '理解检索增强生成的每一步，区分资料、证据与回答。' },
    { id: 'task4', number: 4, title: '搭建数据层，走近 SQL × AI', days: 3, deadline: '2026-11-27T03:00:00+08:00', chapters: ['D2', 'I3'], description: '通过数据写入、检索与函数调用，观察数据层怎样支撑 AI。' },
    { id: 'task5', number: 5, title: '设计记忆，连接文件数据', days: 3, deadline: '2026-11-30T03:00:00+08:00', chapters: ['P3', 'I4'], description: '思考该记住什么，再了解 Agent 如何访问文件数据。' },
    { id: 'task6', number: 6, title: '动手构建 Agentic RAG', days: 3, deadline: '2026-12-03T03:00:00+08:00', chapters: ['D3', 'I5'], description: '串起提问、检索与回答，观察模型驱动数据的更新过程。' },
    { id: 'task7', number: 7, title: '整理 Skill，组织上下文', days: 3, deadline: '2026-12-06T03:00:00+08:00', chapters: ['P4', 'I6'], description: '把操作经验变成可复用知识，让模型在合适的时候看到它。' },
    { id: 'task8', number: 8, title: '实现记忆与上下文管理', days: 3, deadline: '2026-12-09T03:00:00+08:00', chapters: ['D4', 'I7'], description: '练习记忆的保存、取回与遗忘，理解上下文如何组织。' },
    { id: 'task9', number: 9, title: '回顾、评估与课程总结', days: 3, deadline: '2026-12-12T03:00:00+08:00', chapters: ['P5', 'D5', 'I8'], description: '用案例和评测检查学习成果，整理下一步想探索的问题。' }
  ];
  const data = { courseId: 'easy-data-x-ai-2026-11', start: '2026-11-16T00:00:00+08:00', declaredDays: 29, timezone: 'Asia/Shanghai', chapters, tasks };
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.CourseData = data;
})(globalThis);
