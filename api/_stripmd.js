// api/_stripmd.js — letters are plain text. Removes markdown the model sometimes emits anyway: code fences,
// # headings, **bold** / __bold__, *italic* / _italic_, bullet markers, |tables|, blockquotes, rules, links.
// Shared by api/generate.js (server) and src/App.jsx (display, copy, PDF, email). No imports, Edge/browser safe.
export function stripMarkdown(input) {
  let s = String(input == null ? '' : input).replace(/\r\n/g, '\n');
  s = s.replace(/^[ \t]*(```|~~~)[^\n]*$/gm, '\u0000');           // fence lines (content is kept)
  s = s.split('\n').filter(l => l !== '\u0000').map(line => {
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return '';          // horizontal rule
    if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && /-/.test(line)) return null; // table separator row
    let l = line.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/\s+#+\s*$/, '');
    l = l.replace(/^\s{0,3}>\s?/, '');
    if (/^\s*\|.*\|\s*$/.test(l)) l = l.trim().slice(1, -1).split('|').map(c => c.trim()).filter(Boolean).join(', ');
    l = l.replace(/^(\s*)[*+•]\s+/, '$1- ');
    return l;
  }).filter(l => l !== null).join('\n');
  s = s.replace(/!?\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)');
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '$1').replace(/\*\*([^*\n]+?)\*\*/g, '$1').replace(/__([^_\n]+?)__/g, '$1');
  s = s.replace(/(^|[^*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g, '$1$2');
  s = s.replace(/(^|[^_\w])_(?![\s_])([^_\n]+?)(?<![\s_])_(?![_\w])/g, '$1$2');
  s = s.replace(/`([^`\n]+)`/g, '$1');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}
