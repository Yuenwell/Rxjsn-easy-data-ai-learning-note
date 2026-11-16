(function () {
  'use strict';
  const D = window.CourseData, C = window.CourseCore;
  const KEY = 'learning-dashboard.' + D.courseId + '.v1';
  const IMPORT_BACKUP = KEY + '.before-import';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const labels = { new: '未开始', learning: '学习中', learned: '已学完', submitted: '已打卡' };
  const I = window.CourseImages;
  let draftImages = [], imageBusy = false, imageGeneration = 0;
  let state = C.initialState(), storedRevision = 0, blocked = false, damagedRaw = '', currentView = 'overview', filter = 'all', selectedTask = null, editingLog = null, toastTimer;
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: D.timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fullFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: D.timezone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const displayTime = date => dateFormatter.format(new Date(date));
  const displayDuration = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ' ' + minutes % 60 + ' 分钟' : ''}` : `${minutes} 分钟`;
  function toast(message, error = false) {
    const el = $('#toast'); clearTimeout(toastTimer); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function warning(message, actions = '') {
    const el = $('#storage-warning'); el.hidden = false; el.innerHTML = `${esc(message)}${actions}`;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try { state = C.validateState(JSON.parse(raw)); storedRevision = state.revision; }
        catch (error) {
          damagedRaw = raw; blocked = true;
          warning('原有进度暂时无法读取，原始内容已保留，未被覆盖。可以下载原始记录，再导入有效备份；或确认后重新开始。', '<br><button class="button" id="download-damaged">下载原始记录</button><button class="button" id="reset-damaged">重新开始</button>');
        }
      }
    } catch (error) { warning('浏览器未允许本地保存。你仍可记录并导出备份，但关闭页面前请务必导出。'); }
  }
  function commit(change) {
    if (blocked) { toast('请先处理顶部的保存提示，避免覆盖原有记录。', true); return false; }
    const next = C.clone(state); change(next);
    try { C.validateState(next); } catch (error) { toast(error.message, true); return false; }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const remote = C.validateState(JSON.parse(raw));
        if (remote.revision !== storedRevision) {
          blocked = true;
          warning('另一个窗口已经更新了进度。本窗口暂停写入，避免互相覆盖。请先导出需要保留的记录，再刷新此页。', '<br><button class="button" id="reload-state">刷新读取最新进度</button>');
          toast('检测到其他窗口更新，请刷新后继续。', true); return false;
        }
      } else if (storedRevision !== 0) {
        blocked = true; warning('浏览器中的记录已被其他窗口移除。当前记录仍在本页，请先导出备份，再刷新。', '<br><button class="button" id="reload-state">刷新页面</button>'); return false;
      }
      next.revision = storedRevision + 1; next.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(next));
      storedRevision = next.revision; state = next;
      $('#save-state').textContent = '已自动保存 · ' + new Intl.DateTimeFormat('zh-CN', { timeZone: D.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      return true;
    } catch (error) {
      // Retain unsaved edits in memory so that export still includes them.
      next.updatedAt = new Date().toISOString(); state = next;
      $('#save-state').textContent = '保存失败 · 请导出备份';
      warning('浏览器保存失败，当前修改暂留在本页。关闭或刷新之前，请点击“导出备份”保存。');
      return true;
    }
  }
  function switchView(view) {
    if (!['overview', 'journal', 'about'].includes(view)) return;
    currentView = view;
    for (const name of ['overview', 'journal', 'about']) $('#' + name + '-view').hidden = name !== view;
    document.querySelectorAll('nav [data-view]').forEach(button => {
      const active = button.dataset.view === view; button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    $('#page-crumb').textContent = { overview: '学习看板', journal: '学习日志', about: '课表与说明' }[view];
    history.replaceState(null, '', '#' + view); render(); window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function sortedLogs() { return [...state.logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }
  function exportLogs() { return [...state.logs].sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.createdAt) - Date.parse(b.createdAt)); }
  function taskName(id) { return D.tasks.find(task => task.id === id)?.title || '自由学习'; }
  function render() {
    const now = new Date(), stats = C.stats(state, now), focus = stats.focus;
    $('#today-label').textContent = fullFormatter.format(now) + ' · 北京时间';
    $('#overall-percent').innerHTML = `${stats.percent}<span>%</span>`;
    $('#overall-ring').style.setProperty('--progress', stats.percent + '%');
    $('#overall-ring').setAttribute('aria-label', `学习进度 ${stats.percent}%，已完成 ${stats.complete} / ${stats.total} 个学习项`);
    $('#learning-count').textContent = `${stats.complete} / ${stats.total}`;
    $('#submitted-count').textContent = `${stats.submitted} / ${D.tasks.length}`;
    $('#total-time').textContent = displayDuration(stats.minutes);
    $('#journal-total').textContent = `${state.logs.length} 条`; $('#log-count').textContent = state.logs.length;
    $('#deadline-stat').innerHTML = stats.overdue ? `待补打卡 <strong>${stats.overdue} 个任务</strong>` : focus ? `最近截止 <strong>${esc(displayTime(state.tasks[focus.id].deadline))}</strong>` : '全部任务已记录打卡';
    if (focus) {
      $('#focus-kicker').textContent = `TASK ${String(focus.number).padStart(2, '0')} · ${Date.parse(state.tasks[focus.id].deadline) <= now.getTime() ? '待补打卡' : '下一步学习'}`;
      $('#focus-title').textContent = focus.title;
      $('#focus-description').textContent = focus.description;
      $('#focus-deadline').textContent = '截止 ' + displayTime(state.tasks[focus.id].deadline);
      $('#focus-countdown').textContent = C.countdown(state.tasks[focus.id].deadline, now);
      $('#continue-task').innerHTML = `${C.taskStatus(focus, state.tasks[focus.id]) === 'new' ? '开始学习' : '查看进度'} <span aria-hidden="true">→</span>`;
    } else {
      $('#focus-kicker').textContent = '这一期，已经留下完整的足迹'; $('#focus-title').textContent = '9 个任务，全部记录完成';
      $('#focus-description').textContent = '回看学习笔记，整理那些已经理解和还想继续探索的问题。';
      $('#focus-deadline').textContent = '可以导出备份，保留这一期的学习记录'; $('#focus-countdown').textContent = '已完成';
      $('#continue-task').innerHTML = '回看学习日志 <span aria-hidden="true">→</span>';
    }
    const tasks = D.tasks.filter(task => filter === 'all' || (filter === 'submitted' ? !!state.tasks[task.id].submittedAt : !state.tasks[task.id].submittedAt));
    $('#task-grid').innerHTML = tasks.map(task => {
      const record = state.tasks[task.id], status = C.taskStatus(task, record), count = record.completed.length, overdue = !record.submittedAt && Date.parse(record.deadline) <= now.getTime();
      return `<article class="task-card ${focus?.id === task.id ? 'current' : ''}" data-task-card="${task.id}"><div class="task-top"><span class="task-number">TASK ${String(task.number).padStart(2, '0')}</span><span class="status ${status}">${labels[status]}</span></div><h3>${esc(task.title)}</h3><div class="task-due">${esc(displayTime(record.deadline))} 截止${overdue ? ' · 已逾期' : ''}${record.deadline !== task.deadline ? ' · 已调整' : ''}</div><div class="task-chapters">${task.chapters.map(code => `<span class="chapter-tag ${record.completed.includes(code) ? 'done' : ''}">${esc(code)}${record.completed.includes(code) ? ' ✓' : ''}</span>`).join('')}</div>${task.mismatch ? '<div class="card-note">课表名称有差异 · 详见任务</div>' : ''}<div class="mini-progress" role="img" aria-label="完成 ${count} / ${task.chapters.length} 项"><span style="width:${count / task.chapters.length * 100}%"></span></div><div class="task-bottom"><span>${count} / ${task.chapters.length} 已学${record.note ? ' · 有笔记' : ''}</span><button class="task-open" data-open-task="${task.id}" aria-label="打开 Task ${task.number} ${esc(task.title)}">查看任务 →</button></div></article>`;
    }).join('');
    $('#empty-tasks').hidden = tasks.length > 0;
    const recent = sortedLogs().slice(0, 3);
    $('#recent-logs').innerHTML = recent.length ? recent.map(log => `<div class="recent-log"><div class="log-meta"><span>${esc(log.date)}</span><span>${esc(taskName(log.taskId))}</span>${log.minutes ? `<span>${log.minutes} 分钟</span>` : ''}</div>${log.title?.trim() ? `<h3 class="record-title">${esc(log.title)}</h3>` : ''}<p>${esc(log.content)}</p>${log.images?.length ? `<small class="subtle-help">附 ${log.images.length} 张截图 · 在学习日志查看</small>` : ''}</div>`).join('') : '<div class="empty">还没有学习记录。<br>先写下一句今天理解的内容吧。</div>';
    $('#journal-list').innerHTML = state.logs.length ? sortedLogs().map(log => `<article class="journal-entry"><div class="journal-date">${esc(log.date)}<small>${log.minutes ? displayDuration(log.minutes) : '未记录时长'}</small></div><div><div class="log-meta">${esc(taskName(log.taskId))}</div>${log.title?.trim() ? `<h2 class="record-title">${esc(log.title)}</h2>` : ''}<p class="journal-content">${esc(log.content)}</p>${gallery(log)}<div class="log-actions"><button class="text-button" data-edit-log="${esc(log.id)}">编辑</button><button class="text-button" data-delete-log="${esc(log.id)}">删除</button></div></div></article>`).join('') : '<div class="empty">你的学习记录会出现在这里。点击“写一条记录”开始。</div>';
    $('#schedule-table').innerHTML = `<table><caption class="subtle-help">已列出的 9 个任务</caption><thead><tr><th>任务</th><th>天数</th><th>截止 · 北京时间</th></tr></thead><tbody>${D.tasks.map(task => `<tr><td>Task ${task.number}</td><td>${task.days} 天</td><td>${esc(displayTime(state.tasks[task.id].deadline))}${state.tasks[task.id].deadline !== task.deadline ? '（已调整）' : ''}</td></tr>`).join('')}</tbody></table>`;
    renderDialogSummary();
  }
  function openTask(id) {
    const task = D.tasks.find(item => item.id === id); if (!task) return;
    selectedTask = id; const record = state.tasks[id];
    $('#task-dialog-content').innerHTML = `<div class="dialog-header"><div><span class="eyebrow">TASK ${String(task.number).padStart(2, '0')} · ${task.days} 天</span><h2 id="task-dialog-title">${esc(task.title)}</h2></div><button class="close-button" data-close="task-dialog" aria-label="关闭任务详情">×</button></div><div class="dialog-body"><div class="detail-line"><span>截止 <strong id="detail-deadline">${esc(displayTime(record.deadline))}</strong> · 北京时间</span><span id="detail-progress"></span></div>${task.note ? `<div class="details-note">${esc(task.note)}</div>` : ''}<div class="dialog-chapters">${task.chapters.map(code => `<div class="dialog-chapter"><input type="checkbox" id="chapter-${code}" data-chapter="${code}" ${record.completed.includes(code) ? 'checked' : ''}><div><label for="chapter-${code}"><span class="chapter-code">${esc(code)}</span>${esc(D.chapters[code].title)}</label><small>${esc(D.chapters[code].track)}</small></div><a href="${esc(D.chapters[code].url)}" target="_blank" rel="noopener noreferrer">去学习 ↗</a></div>`).join('')}</div><label for="task-note">任务笔记 <span class="note-save">输入后自动保存</span><textarea id="task-note" maxlength="10000" rows="5" placeholder="我理解了什么？还有哪些疑问？练习结果在哪里？">${esc(record.note)}</textarea></label><label for="task-references">参考来源 <span class="note-save">按 Task 保存，输入后自动保存</span><textarea id="task-references" maxlength="10000" rows="4" placeholder="每行写一项，也可以使用 Markdown 链接：&#10;- [参考库名称](https://github.com/作者/库名)&#10;- [课程章节](https://…)">${esc(record.references || '')}</textarea></label><p class="subtle-help">填写实际参考的教程、库、论文或图片来源。导出只使用这里的内容；不填则不附加参考来源段落。正文中已有的来源会原样保留。</p><div class="submission-box"><label><input type="checkbox" id="task-submitted" ${record.submittedAt ? 'checked' : ''}>我已在课程平台完成本任务打卡</label><p id="submission-help"></p></div><label for="submission-url">打卡或作业链接（可选）<input type="url" id="submission-url" maxlength="2000" placeholder="https://…" value="${esc(record.submissionUrl)}"></label><details class="deadline-edit"><summary>调整截止时间</summary><div class="form-row"><label>北京时间<input type="datetime-local" id="task-deadline" value="${record.deadline.slice(0, 16)}" min="2000-01-01T00:00" max="2099-12-31T23:59"></label><button class="button" id="reset-deadline">恢复课表日期</button></div><p class="subtle-help">原课表：${esc(displayTime(task.deadline))}。只更改本地记录，不更改课程平台规则。</p></details></div><div class="dialog-footer"><span class="status" id="detail-status"></span><button class="button" id="task-log">记录学习</button><button class="button primary" id="task-start">开始学习</button><button class="button primary" data-close="task-dialog" id="task-close-done">完成</button></div>`;
    renderDialogSummary(); $('#task-dialog').showModal();
  }
  function renderDialogSummary() {
    if (!selectedTask || !$('#detail-progress')) return;
    const task = D.tasks.find(item => item.id === selectedTask), record = state.tasks[selectedTask], status = C.taskStatus(task, record);
    $('#detail-progress').textContent = `已学 ${record.completed.length} / ${task.chapters.length} 项`;
    $('#detail-status').className = 'status ' + status; $('#detail-status').textContent = labels[status];
    $('#detail-deadline').textContent = displayTime(record.deadline);
    $('#task-submitted').checked = !!record.submittedAt;
    $('#task-submitted').disabled = false;
    $('#submission-help').textContent = record.submittedAt ? `已记录打卡：${displayTime(record.submittedAt)}。这是本地记录，不会自动向课程平台提交。` : '按课程实际要求完成打卡后，再在这里确认；辅助学习清单不限制打卡记录。';
    $('#task-start').hidden = status !== 'new'; $('#task-close-done').hidden = status === 'new';
  }
  function openLog(id = null, taskId = '') {
    editingLog = id;
    const log = state.logs.find(item => item.id === id);
    imageGeneration++; imageBusy = false; draftImages = C.clone(log?.images || []);
    renderDraftImages();
    $('#log-form').reset(); $('#log-error').textContent = '';
    $('#log-dialog-title').textContent = log ? '编辑学习记录' : '记录一次学习';
    $('#log-date').value = log?.date || C.beijingDay(); $('#log-date').max = C.beijingDay();
    $('#log-minutes').value = log?.minutes || '';
    $('#log-task').innerHTML = '<option value="">自由学习 / 未关联任务</option>' + D.tasks.map(task => `<option value="${task.id}">Task ${task.number} · ${esc(task.title)}</option>`).join('');
    const exportTask = $('#export-task').value;
    $('#log-task').value = log ? log.taskId : taskId || (D.tasks.some(task => task.id === exportTask) ? exportTask : '');
    $('#log-title').value = log?.title || '';
    $('#log-content').value = log?.content || ''; $('#log-dialog').showModal();
  }
  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function exportBackup() {
    const wrapper = { format: 'rag-learning-dashboard', version: 1, exportedAt: new Date().toISOString(), state };
    download(JSON.stringify(wrapper, null, 2), `RAG学习进度-${C.beijingDay()}.json`, 'application/json;charset=utf-8');
    toast('备份已导出，请妥善保存下载的 JSON 文件。');
  }
  function exportMarkdown() {
    const output = buildNotes(false); if (!output) return;
    download(output.text, `${output.filename}-学习记录-${C.beijingDay()}.md`, 'text/markdown;charset=utf-8');
    toast(output.hasImages ? '已导出文字；包含图片请使用“导出图文笔记 ZIP”。' : '学习记录已导出为 Markdown。');
  }
  function renderDraftImages() {
    $('#log-image-preview').innerHTML = draftImages.map((image, index) => `<div class="draft-image"><button type="button" data-draft-preview="${index}" aria-label="预览截图 ${index + 1}"><img src="${image.data}" alt="${esc(image.name)}"></button><span>${esc(image.name)}</span><button type="button" class="text-button" data-remove-image="${index}">移除</button></div>`).join('');
    $('#image-capacity').textContent = `${draftImages.length} / ${I.MAX_COUNT} 张 · ${imageBusy ? '正在处理…' : '支持选择图片或在此窗口按 Ctrl+V 粘贴截图'}`;
    $('#log-form button[type=submit]').disabled = imageBusy;
  }
  async function addImages(files) {
    if (imageBusy || !$('#log-dialog').open) return;
    const batch = [...files]; if (!batch.length) return;
    if (draftImages.length + batch.length > I.MAX_COUNT) { $('#log-error').textContent = `每条记录最多 ${I.MAX_COUNT} 张截图。`; return; }
    imageBusy = true; const generation = imageGeneration; renderDraftImages();
    try {
      const prepared = []; for (const file of batch) prepared.push(await I.prepare(file));
      if (generation !== imageGeneration) return;
      const oldSize = state.logs.filter(log => log.id !== editingLog).reduce((sum, log) => sum + (log.images || []).reduce((n, image) => n + image.data.length, 0), 0);
      const size = [...draftImages, ...prepared].reduce((sum, image) => sum + image.data.length, oldSize);
      if (size > I.MAX_TOTAL) throw new Error('截图存储空间不足。请先导出图文笔记归档，再整理旧截图。');
      draftImages.push(...prepared); $('#log-error').textContent = '';
    } catch (error) { if (generation === imageGeneration) $('#log-error').textContent = error.message; }
    finally { if (generation === imageGeneration) { imageBusy = false; renderDraftImages(); } }
  }
  function gallery(log) {
    return (log.images || []).length ? `<div class="log-gallery">${log.images.map((image, index) => `<button type="button" data-image-log="${esc(log.id)}" data-image-index="${index}" aria-label="放大截图 ${index + 1}"><img src="${image.data}" loading="lazy" alt="${esc(image.name)}"><span>截图 ${index + 1} · 点击放大</span></button>`).join('')}</div>` : '';
  }
  function previewImage(image) {
    if (!image) return;
    $('#image-full').src = image.data; $('#image-full').alt = image.name; $('#image-title').textContent = image.name;
    $('#image-dialog').showModal();
  }
  function buildNotes(includeImages) {
    const scope = $('#export-task').value, task = D.tasks.find(item => item.id === scope);
    const taskTitle = item => `Task${String(item.number).padStart(2, '0')}：${item.title}`;
    const groups = scope === 'all' ? [...D.tasks, { id: '', title: '自由学习 / 未关联任务' }] : task ? [task] : [{ id: '', title: '自由学习 / 未关联任务' }];
    const logs = exportLogs().filter(log => scope === 'all' || log.taskId === (task?.id || ''));
    if (!logs.length && !groups.some(item => state.tasks[item.id]?.note.trim() || state.tasks[item.id]?.references?.trim())) {
      toast('这个范围还没有笔记或日志。可编辑已有日志的“关联任务”后再导出。', true); return null;
    }
    const title = task ? taskTitle(task) : scope === 'unassigned' ? '自由学习笔记' : 'Easy Data × AI 学习笔记';
    const notes = [`# ${title}`, '', `导出日期：${C.beijingDay()}（北京时间）`, ''], files = [];
    let imageNumber = 0;
    for (const group of groups) {
      const note = state.tasks[group.id]?.note || '', references = state.tasks[group.id]?.references || '', entries = logs.filter(log => log.taskId === group.id);
      if (!note.trim() && !references.trim() && !entries.length) continue;
      if (scope === 'all') notes.push(`## ${group.id ? taskTitle(group) : group.title}`, '');
      if (note.trim()) notes.push(CourseMarkdown.preserveBreaks(note), '');
      for (const log of entries) {
        // Titles are plain text; escape Markdown punctuation so they stay one heading.
        if (log.title?.trim()) notes.push(`${scope === 'all' ? '###' : '##'} ${log.title.trim().replace(/[\\`*_{}\[\]()#+.!<>|~-]/g, '\\$&')}`, '');
        notes.push(`学习日期：${log.date}`, '');
        notes.push(CourseMarkdown.preserveBreaks(log.content), '');
        if (!includeImages) continue;
        for (const [index, image] of (log.images || []).entries()) {
          const ext = image.data.startsWith('data:image/png;') ? 'png' : image.data.startsWith('data:image/webp;') ? 'webp' : 'jpg';
          const filename = `images/${log.id}-${index + 1}.${ext}`;
          files.push({ name: filename, content: I.bytes(image.data) }); notes.push(`![学习截图 ${++imageNumber}](${filename})`, '');
        }
      }
      if (references.trim()) notes.push(`${scope === 'all' ? '###' : '##'} 参考来源`, '', CourseMarkdown.preserveBreaks(references), '');
    }
    return { text: notes.join('\n'), files, filename: task ? `Task${String(task.number).padStart(2, '0')}` : scope === 'unassigned' ? '自由学习' : '全部任务', hasImages: logs.some(log => log.images?.length) };
  }
  function exportPictureNotes() {
    const output = buildNotes(true); if (!output) return;
    output.files.unshift({ name: 'README.md', content: output.text });
    download(I.zip(output.files), `${output.filename}-图文笔记-${C.beijingDay()}.zip`, 'application/zip'); toast('图文笔记已导出；解压后包含 Markdown 和图片。');
  }
  async function importBackup(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('备份超过 8 MB，未导入。', true); return; }
    let incoming;
    try {
      const wrapper = JSON.parse(await file.text());
      if (wrapper.format !== 'rag-learning-dashboard' || wrapper.version !== 1) throw new Error('这不是本看板导出的备份文件');
      incoming = C.validateState(wrapper.state);
    } catch (error) { toast('导入失败，当前进度未改变：' + error.message, true); return; }
    if (!window.confirm('导入将替换本页的进度、笔记和日志。建议先导出当前备份。确定导入？')) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(IMPORT_BACKUP, raw);
      const revision = Math.max(state.revision, incoming.revision, storedRevision) + 1;
      incoming.revision = revision; incoming.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(incoming));
      storedRevision = revision; state = incoming; blocked = false; damagedRaw = '';
      $('#storage-warning').hidden = true; $('#save-state').textContent = '备份已恢复并保存';
      render(); toast('备份已恢复。');
    } catch (error) { toast('无法将备份保存到浏览器；当前进度未替换，请检查浏览器存储设置。', true); }
  }
  document.addEventListener('click', event => {
    const view = event.target.closest('[data-view]'); if (view) { switchView(view.dataset.view); return; }
    const close = event.target.closest('[data-close]'); if (close) { $('#' + close.dataset.close).close(); render(); return; }
    const open = event.target.closest('[data-open-task]'); if (open) { openTask(open.dataset.openTask); return; }
    const tab = event.target.closest('[data-filter]'); if (tab) {
      filter = tab.dataset.filter; document.querySelectorAll('[data-filter]').forEach(button => { const selected = button.dataset.filter === filter; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); }); render(); return;
    }
    if (event.target.closest('[data-action="new-log"]')) { openLog(); return; }
    const imageButton = event.target.closest('[data-image-log]');
    if (imageButton) { const log = state.logs.find(item => item.id === imageButton.dataset.imageLog); previewImage(log?.images?.[Number(imageButton.dataset.imageIndex)]); return; }
    const draftButton = event.target.closest('[data-draft-preview]'); if (draftButton) { previewImage(draftImages[Number(draftButton.dataset.draftPreview)]); return; }
    const removeImage = event.target.closest('[data-remove-image]'); if (removeImage && !imageBusy) { draftImages.splice(Number(removeImage.dataset.removeImage), 1); renderDraftImages(); return; }
    const edit = event.target.closest('[data-edit-log]'); if (edit) { openLog(edit.dataset.editLog); return; }
    const remove = event.target.closest('[data-delete-log]'); if (remove) {
      if (window.confirm('删除这条学习记录？这不会改变章节完成状态。') && commit(next => { next.logs = next.logs.filter(log => log.id !== remove.dataset.deleteLog); })) { render(); toast('记录已删除。'); } return;
    }
    const button = event.target.closest('button'); if (!button) return;
    if (button.id === 'continue-task') { const focus = C.stats(state).focus; if (focus) openTask(focus.id); else switchView('journal'); }
    if (button.id === 'task-start' && selectedTask) { if (commit(next => { next.tasks[selectedTask].startedAt = new Date().toISOString(); })) { render(); toast('已记录开始学习。'); } }
    if (button.id === 'task-log') { $('#task-dialog').close(); openLog(null, selectedTask); }
    if (button.id === 'reset-deadline' && selectedTask) { const task = D.tasks.find(item => item.id === selectedTask); if (commit(next => { next.tasks[selectedTask].deadline = task.deadline; })) { $('#task-deadline').value = task.deadline.slice(0, 16); render(); toast('已恢复原课表日期。'); } }
    if (button.id === 'export-json') exportBackup();
    if (button.id === 'export-markdown') exportMarkdown();
    if (button.id === 'export-picture-notes') exportPictureNotes();
    if (button.id === 'add-log-images') { $('#log-image-files').value = ''; $('#log-image-files').click(); }
    if (button.id === 'import-json') { $('#import-file').value = ''; $('#import-file').click(); }
    if (button.id === 'download-damaged') download(damagedRaw, '学习看板-原始记录.txt', 'text/plain;charset=utf-8');
    if (button.id === 'reload-state') window.location.reload();
    if (button.id === 'reset-damaged' && window.confirm('确认放弃无法读取的记录并重新开始？建议先下载原始记录。')) {
      try { localStorage.setItem(IMPORT_BACKUP, damagedRaw); localStorage.removeItem(KEY); blocked = false; state = C.initialState(); storedRevision = 0; damagedRaw = ''; $('#storage-warning').hidden = true; render(); toast('已重新开始。'); }
      catch (error) { toast('浏览器拒绝保存，请先导出原始记录。', true); }
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'task-note' && selectedTask) commit(next => { next.tasks[selectedTask].note = event.target.value; });
    if (event.target.id === 'task-references' && selectedTask) commit(next => { next.tasks[selectedTask].references = event.target.value; });
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.chapter && selectedTask) {
      const record = state.tasks[selectedTask];
      if (record.submittedAt && !el.checked && !window.confirm('取消该学习项会同时取消本地“已打卡”记录，继续？')) { el.checked = true; return; }
      if (!commit(next => { C.updateChapter(next, selectedTask, el.dataset.chapter, el.checked); })) el.checked = record.completed.includes(el.dataset.chapter);
      render();
    }
    if (el.id === 'task-submitted' && selectedTask) { if (commit(next => C.setSubmitted(next, selectedTask, el.checked))) toast(el.checked ? '已记录打卡状态。' : '已取消本地打卡记录。'); render(); }
    if (el.id === 'submission-url' && selectedTask) {
      const value = el.value.trim();
      if (value && !/^https?:\/\//i.test(value)) { el.setCustomValidity('请填写 http:// 或 https:// 链接'); el.reportValidity(); return; }
      el.setCustomValidity(''); if (!commit(next => { next.tasks[selectedTask].submissionUrl = value; })) el.value = state.tasks[selectedTask].submissionUrl;
    }
    if (el.id === 'task-deadline' && selectedTask) {
      const deadline = el.value + ':00+08:00';
      if (!C.validDeadline(deadline)) { toast('请填写有效的北京时间。', true); el.value = state.tasks[selectedTask].deadline.slice(0, 16); return; }
      if (commit(next => { next.tasks[selectedTask].deadline = deadline; })) { render(); toast('已调整本地截止时间。'); }
    }
    if (el.id === 'import-file') importBackup(el.files[0]);
    if (el.id === 'log-image-files') addImages(el.files);
  });
  $('#log-form').addEventListener('submit', event => {
    event.preventDefault(); const content = $('#log-content').value.trim(), date = $('#log-date').value, minutesText = $('#log-minutes').value;
    const title = $('#log-title').value.trim();
    if (imageBusy) return;
    const minutes = minutesText === '' ? 0 : Number(minutesText), taskId = $('#log-task').value;
    if (!content || !C.validDay(date) || date > C.beijingDay() || !Number.isInteger(minutes) || minutes < 0 || minutes > 1440) { $('#log-error').textContent = '请填写有效的日期、分钟数和非空学习内容。'; return; }
    if (!editingLog && state.logs.length >= 3000) { $('#log-error').textContent = '日志已达 3000 条，请先导出归档。'; return; }
    const now = new Date().toISOString();
    if (commit(next => {
      const old = next.logs.find(log => log.id === editingLog);
      if (old) Object.assign(old, { date, taskId, title, minutes, content, images: C.clone(draftImages), updatedAt: now });
      else next.logs.push({ id: 'log-' + (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)), date, taskId, title, minutes, content, images: C.clone(draftImages), createdAt: now, updatedAt: now });
    })) { $('#log-dialog').close(); render(); toast('学习记录已保存。'); }
  });
  $('#task-dialog').addEventListener('close', () => { selectedTask = null; render(); });
  $('#log-dialog').addEventListener('paste', event => {
    const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
    if (files.length) { event.preventDefault(); addImages(files); }
  });
  $('#log-dialog').addEventListener('close', () => { imageGeneration++; imageBusy = false; });
  $('#image-dialog').addEventListener('close', () => { $('#image-full').removeAttribute('src'); });
  window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    blocked = true;
    warning('另一个窗口修改了进度。本窗口暂停写入，避免覆盖。请先导出要保留的记录，再刷新查看最新进度。', '<br><button class="button" id="reload-state">刷新读取最新进度</button>');
  });
  $('#export-task').innerHTML = '<option value="all">全部记录</option>' + D.tasks.map(task => `<option value="${task.id}">Task${String(task.number).padStart(2, '0')} · ${esc(task.title)}</option>`).join('') + '<option value="unassigned">自由学习 / 未关联任务</option>';
  load();
  switchView(['overview', 'journal', 'about'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
  setInterval(render, 60000);
})();
