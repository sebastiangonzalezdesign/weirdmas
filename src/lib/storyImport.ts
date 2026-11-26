import * as mammoth from 'mammoth';

function nodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.matches('hr.page-break')) return '\n\f\n';
  if (node.tagName === 'BR') return '\n';
  const content = Array.from(node.childNodes, nodeText).join('');
  if (/^(P|H1|H2|H3|H4|H5|H6|LI|TR)$/.test(node.tagName)) return `${content.trim()}\n\n`;
  return content;
}

export async function readStoryFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Story files must be 10 MB or smaller.');
  if (/\.(txt|md)$/i.test(file.name) || file.type === 'text/plain' || file.type === 'text/markdown') {
    return file.text();
  }
  if (/\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { styleMap: ['br[type="page"] => hr.page-break:fresh'] },
    );
    if (!result.value.trim()) throw new Error('No story text was found in that Word document.');
    const document = new DOMParser().parseFromString(result.value, 'text/html');
    return Array.from(document.body.childNodes, nodeText).join('').replace(/\n{3,}/g, '\n\n').trim();
  }
  throw new Error('Choose a .txt, .md, or .docx file. Export Google Docs as a Word (.docx) file first.');
}
