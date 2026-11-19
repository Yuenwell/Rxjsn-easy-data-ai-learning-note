/* Preserve plain-text editor line breaks while retaining Markdown block syntax. */
(function (root) {
  'use strict';
  function preserveBreaks(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let fence = null, length = 0;
    const structural = line => /^ {0,3}(?:#{1,6}(?:\s|$)|(?:`{3,}|~{3,})|(?:[-*_]\s*){3,}$|(?:=+|-+)\s*$|\[[^\]]+\]:|<\/?[A-Za-z!])/.test(line);
    const tableSeparator = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    const inTable = new Set(), tableStarts = new Set();
    for (let i = 1; i < lines.length; i++) {
      if (!tableSeparator(lines[i]) || !lines[i - 1].includes('|')) continue;
      tableStarts.add(i - 1);
      inTable.add(i - 1); inTable.add(i);
      for (let j = i + 1; j < lines.length && lines[j].trim() && lines[j].includes('|'); j++) inTable.add(j);
    }
    return lines.map((line, index) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (marker && marker[1][0] === fence && marker[1].length >= length && line.trim() === marker[1]) fence = null;
        return line;
      }
      if (marker) { fence = marker[1][0]; length = marker[1].length; return line; }
      if (/^(?: {4}|\t)/.test(line)) return line;
      if (tableStarts.has(index) && index > 0 && lines[index - 1].trim()) return '\n' + line;
      if (!line.trim() || index === lines.length - 1 || !lines[index + 1].trim()) return line;
      if (structural(line) || inTable.has(index) || tableStarts.has(index + 1) || /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1])) return line;
      if (/ {2,}$|\\$|<br\s*\/?>\s*$/i.test(line)) return line;
      // A pipe character in ordinary prose is still prose; only real tables are excluded.
      return line + '  ';
    }).join('\n');
  }
  if (typeof module === 'object' && module.exports) module.exports = { preserveBreaks };
  else root.CourseMarkdown = { preserveBreaks };
})(globalThis);
