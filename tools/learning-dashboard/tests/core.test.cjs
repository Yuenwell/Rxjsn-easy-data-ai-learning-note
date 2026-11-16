'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../data.js');
const C = require('../core.js');

test('schedule transcription: 9 tasks, page-break I7 and concrete Shanghai deadlines', () => {
  assert.equal(D.tasks.length, 9);
  assert.deepEqual(D.tasks.map(t => t.deadline.slice(5, 10)), ['11-18','11-21','11-24','11-27','11-30','12-03','12-06','12-09','12-12']);
  assert.ok(D.tasks.every(t => t.deadline.endsWith('T03:00:00+08:00')));
  assert.deepEqual(D.tasks[7].chapters, ['D4', 'I7']);
  assert.equal(D.tasks.reduce((sum, t) => sum + t.days, 0), 26);
  assert.equal(D.declaredDays, 29);
  assert.equal(C.stats(C.initialState()).total, 22);
});

test('learning and actual submission are separate; reopening learning clears submission', () => {
  const state = C.initialState(), task = D.tasks[0];
  assert.equal(C.taskStatus(task, state.tasks.task1), 'new');
  C.setSubmitted(state, 'task1', true);
  assert.equal(C.stats(state).submitted, 1);
  C.setSubmitted(state, 'task1', false);
  C.updateChapter(state, 'task1', 'F1', true);
  assert.equal(C.taskStatus(task, state.tasks.task1), 'learning');
  for (const code of task.chapters) C.updateChapter(state, 'task1', code, true);
  assert.equal(C.taskStatus(task, state.tasks.task1), 'learned');
  assert.equal(C.stats(state).submitted, 0);
  C.setSubmitted(state, 'task1', true);
  assert.equal(C.stats(state).submitted, 1);
  C.updateChapter(state, 'task1', 'ENV', false);
  assert.equal(state.tasks.task1.submittedAt, null);
  assert.equal(C.stats(state).submitted, 0);
});

test('Beijing day changes at 16:00 UTC; deadline equality is overdue', () => {
  assert.equal(C.beijingDay('2026-11-15T15:59:59Z'), '2026-11-15');
  assert.equal(C.beijingDay('2026-11-15T16:00:00Z'), '2026-11-16');
  const state = C.initialState();
  assert.equal(C.stats(state, '2026-11-17T18:59:59Z').overdue, 0);
  assert.equal(C.stats(state, '2026-11-17T19:00:00Z').overdue, 1);
  assert.equal(C.countdown(state.tasks.task1.deadline, '2026-11-17T19:00:00Z'), '已到截止时间');
  assert.equal(C.validDay('2026-02-30'), false);
  assert.equal(C.validDeadline('2026-02-30T03:00:00+08:00'), false);
  assert.equal(C.validDeadline('2026-11-18T24:00:00+08:00'), false);
});

test('backup validation rejects unsafe/invalid data, preserves notes and logs', () => {
  const state = C.initialState();
  state.tasks.task1.note = '中文笔记\n下一步：练习检索';
  state.logs.push({ id:'log-test', date:'2026-11-16', taskId:'task1', minutes:45, content:'保留笔记', createdAt:'2026-11-16T01:00:00Z', updatedAt:'2026-11-16T01:00:00Z' });
  assert.deepEqual(C.validateState(state), state);
  for (const corrupt of [s => s.courseId = 'another-course', s => s.tasks.task1.completed = ['UNKNOWN'], s => s.tasks.task1.submissionUrl = 'javascript:alert(1)', s => s.logs[0].minutes = -5, s => s.logs[0].date = '2026-02-30', s => s.logs.push({...s.logs[0]})]) {
    const broken = C.clone(state); corrupt(broken); assert.throws(() => C.validateState(broken));
  }
});

test('all completed, overdue focus and rescheduling behave consistently', () => {
  const state = C.initialState();
  state.tasks.task1.deadline = '2026-12-15T03:00:00+08:00';
  assert.equal(C.stats(state, '2026-11-16T09:00:00+08:00').focus.id, 'task2');
  for (const task of D.tasks) { for (const code of task.chapters) C.updateChapter(state, task.id, code, true); C.setSubmitted(state, task.id, true); }
  const stats = C.stats(state, '2027-01-01T00:00:00Z');
  assert.equal(stats.percent, 100); assert.equal(stats.focus, null); assert.equal(stats.overdue, 0); assert.equal(stats.submitted, 9);
});
