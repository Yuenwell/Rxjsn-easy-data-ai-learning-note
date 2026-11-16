const test=require('node:test'),assert=require('node:assert/strict');
const {preserveBreaks}=require('../markdown.js');
test('plain lines retain visible breaks; paragraphs and existing hard breaks stay stable',()=>{
 assert.equal(preserveBreaks('第一行\r\n第二行\n\n第三段'), '第一行  \n第二行\n\n第三段');
 const s='第一行  \n第二行\\\n第三行';assert.equal(preserveBreaks(s),s);assert.equal(preserveBreaks(preserveBreaks(s)),preserveBreaks(s));
});
test('fenced code, indented code, headings and real tables are preserved',()=>{
 const s='# 标题\n\n```python\nx = 1\nprint(x)\n```\n\n    x = 2\n    print(x)\n\n| 名称 | 链接 |\n| --- | --- |\n| A | https://example.org |\n| B | https://example.com |';
 assert.equal(preserveBreaks(s),s);
 assert.equal(preserveBreaks('A | B\n第二行'),'A | B  \n第二行');
});
test('list continuation keeps text and explicit breaks, nested code is unchanged',()=>{
 const s='1. 问题一\n解释一\n2. 问题二\n解释二';
 assert.equal(preserveBreaks(s),'1. 问题一  \n解释一  \n2. 问题二  \n解释二');
 const fenced='~~~js\nline 1\n```\nline 2\n~~~';assert.equal(preserveBreaks(fenced),fenced);
});
