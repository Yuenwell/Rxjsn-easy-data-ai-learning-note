(function (root) {
  'use strict';
  const data = typeof module === 'object' && module.exports ? require('./data.js') : root.CourseData;
  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
  const optionalTime = value => value === null || isTime(value);
  function beijingDay(date = new Date()) { return new Date(new Date(date).getTime() + 8 * 3600000).toISOString().slice(0, 10); }
  function validDay(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00+08:00')) && beijingDay(value + 'T00:00:00+08:00') === value;
  }
  function validDeadline(value) {
    if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(value) || !isTime(value)) return false;
    return new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16) === value.slice(0, 16);
  }
  function initialState() {
    return { schemaVersion: 1, courseId: data.courseId, revision: 0, updatedAt: null, tasks: Object.fromEntries(data.tasks.map(task => [task.id, { completed: [], startedAt: null, submittedAt: null, note: '', references: '', submissionUrl: '', deadline: task.deadline }])), logs: [] };
  }
  function validateState(value) {
    const fail = message => { throw new Error('备份格式不正确：' + message); };
    if (!isObject(value) || value.schemaVersion !== 1 || value.courseId !== data.courseId) fail('课程或版本不匹配');
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !optionalTime(value.updatedAt)) fail('保存版本无效');
    if (!isObject(value.tasks) || Object.keys(value.tasks).length !== data.tasks.length) fail('任务数量不匹配');
    const state = initialState();
    state.revision = value.revision; state.updatedAt = value.updatedAt;
    for (const task of data.tasks) {
      const item = value.tasks[task.id];
      if (!isObject(item)) fail('缺少 ' + task.id);
      if (!Array.isArray(item.completed) || new Set(item.completed).size !== item.completed.length || item.completed.some(code => !task.chapters.includes(code))) fail('学习项无效');
      if (!optionalTime(item.startedAt) || !optionalTime(item.submittedAt)) fail('任务时间无效');
      if (!validDeadline(item.deadline)) fail('截止时间无效');
      if (typeof item.note !== 'string' || item.note.length > 10000) fail('任务笔记过长或无效');
      if (item.references !== undefined && (typeof item.references !== 'string' || item.references.length > 10000)) fail('参考来源应为不超过 10000 字的文字');
      if (typeof item.submissionUrl !== 'string' || item.submissionUrl.length > 2000) fail('打卡链接无效');
      if (item.submissionUrl && !/^https?:\/\//i.test(item.submissionUrl)) fail('打卡链接只能使用 http 或 https');
      state.tasks[task.id] = { completed: [...item.completed], startedAt: item.startedAt, submittedAt: item.submittedAt, note: item.note, references: item.references || '', submissionUrl: item.submissionUrl, deadline: item.deadline };
    }
    if (!Array.isArray(value.logs) || value.logs.length > 3000) fail('日志数量无效');
    const ids = new Set(); let imageSize = 0;
    state.logs = value.logs.map(log => {
      if (!isObject(log) || typeof log.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(log.id) || ids.has(log.id)) fail('日志编号无效');
      if (!validDay(log.date) || !isTime(log.createdAt) || !isTime(log.updatedAt)) fail('日志日期无效');
      if (log.taskId !== '' && !data.tasks.some(task => task.id === log.taskId)) fail('日志任务无效');
      if (!Number.isInteger(log.minutes) || log.minutes < 0 || log.minutes > 1440) fail('学习分钟数无效');
      if (typeof log.content !== 'string' || !log.content.trim() || log.content.length > 10000) fail('日志内容无效');
      if (log.title !== undefined && (typeof log.title !== 'string' || log.title.length > 120 || /[\r\n]/.test(log.title))) fail('记录标题应为不超过 120 字的单行文字');
      if (log.images !== undefined) {
        if (!Array.isArray(log.images) || log.images.length > 6) fail('每条日志最多 6 张截图');
        for (const image of log.images) {
          if (!isObject(image) || typeof image.name !== 'string' || image.name.length > 200 || typeof image.data !== 'string' || image.data.length > 320000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data)) fail('截图格式无效');
          imageSize += image.data.length;
        }
        if (imageSize > 2000000) fail('截图总容量超过本地看板限额，请先导出归档并整理旧截图');
      }
      ids.add(log.id);
      return { id: log.id, date: log.date, taskId: log.taskId, minutes: log.minutes, content: log.content, createdAt: log.createdAt, updatedAt: log.updatedAt, ...(log.title !== undefined ? { title: log.title } : {}), ...(log.images !== undefined ? { images: log.images.map(image => ({ name: image.name, data: image.data })) } : {}) };
    });
    return state;
  }
  function taskStatus(task, record) {
    if (record.submittedAt) return 'submitted';
    if (record.completed.length === task.chapters.length) return 'learned';
    if (record.startedAt || record.completed.length) return 'learning';
    return 'new';
  }
  function stats(state, now = new Date()) {
    const unfinished = data.tasks.filter(task => !state.tasks[task.id].submittedAt).sort((a, b) => Date.parse(state.tasks[a.id].deadline) - Date.parse(state.tasks[b.id].deadline));
    const complete = data.tasks.reduce((sum, task) => sum + state.tasks[task.id].completed.length, 0);
    const total = data.tasks.reduce((sum, task) => sum + task.chapters.length, 0);
    return { complete, total, percent: Math.round(complete / total * 100), submitted: data.tasks.length - unfinished.length, minutes: state.logs.reduce((sum, log) => sum + log.minutes, 0), overdue: unfinished.filter(task => Date.parse(state.tasks[task.id].deadline) <= new Date(now).getTime()).length, focus: unfinished[0] || null };
  }
  function countdown(deadline, now = new Date()) {
    const diff = Date.parse(deadline) - new Date(now).getTime();
    const minutes = Math.ceil(Math.abs(diff) / 60000);
    const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
    const duration = days ? `${days} 天 ${hours} 小时` : hours ? `${hours} 小时 ${mins} 分` : `${Math.max(1, mins)} 分钟`;
    if (diff === 0) return '已到截止时间';
    return (diff < 0 ? '已过期 ' : '剩余 ') + duration;
  }
  function updateChapter(state, taskId, code, done, now = new Date().toISOString()) {
    const task = data.tasks.find(item => item.id === taskId);
    if (!task || !task.chapters.includes(code)) throw new Error('未知学习项');
    const record = state.tasks[taskId];
    const set = new Set(record.completed);
    if (done) { set.add(code); record.startedAt ||= now; } else { set.delete(code); record.submittedAt = null; }
    record.completed = task.chapters.filter(item => set.has(item));
  }
  function setSubmitted(state, taskId, submitted, now = new Date().toISOString()) {
    const task = data.tasks.find(item => item.id === taskId), record = state.tasks[taskId];
    if (!task || !record) throw new Error('未知任务');
    record.submittedAt = submitted ? now : null;
  }
  const api = { clone, initialState, validateState, beijingDay, validDay, validDeadline, taskStatus, stats, countdown, updateChapter, setSubmitted };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CourseCore = api;
})(globalThis);
