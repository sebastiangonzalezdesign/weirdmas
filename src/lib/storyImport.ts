import * as mammoth from 'mammoth';
import { groupStoryPagesByChapter, newStoryBlock, newStoryId, parseStoryDocument, type StoryBlock, type StoryBlockStyle, type StoryChapter, type StoryPage } from './storyDocument';

export async function readStoryFile(file: File): Promise<StoryChapter[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Story files must be 10 MB or smaller.');
  if (/\.(txt|md)$/i.test(file.name) || file.type === 'text/plain' || file.type === 'text/markdown') {
    return parseStoryDocument(await file.text());
  }
  if (/\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { styleMap: ['br[type="page"] => hr.page-break:fresh'] },
    );
    if (!result.value.trim()) throw new Error('No story text was found in that Word document.');
    const document = new DOMParser().parseFromString(result.value, 'text/html');
    let blocks: StoryBlock[] = [];
    const pages: StoryPage[] = [];
    const flushPage = () => {
      if (blocks.length) pages.push({ id: newStoryId(), blocks });
      blocks = [];
    };
    const processBlock = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const style: StoryBlockStyle = /^h[1-4]$/.test(tag) ? tag as StoryBlockStyle : 'normal';
      let text = '';
      let bold = false;
      let italic = false;
      const flushBlock = () => {
        const value = text.trim();
        if (value) { const block = newStoryBlock(value, style); block.bold = bold; block.italic = italic; blocks.push(block); }
        text = ''; bold = false; italic = false;
      };
      const walkInline = (node: Node, isBold = false, isItalic = false) => {
        if (node.nodeType === Node.TEXT_NODE) { text += node.textContent ?? ''; bold ||= isBold; italic ||= isItalic; return; }
        if (!(node instanceof Element)) return;
        if (node.matches('hr.page-break')) { flushBlock(); flushPage(); return; }
        if (node.tagName === 'BR') { text += '\n'; return; }
        const nextBold = isBold || /^(STRONG|B)$/.test(node.tagName);
        const nextItalic = isItalic || /^(EM|I)$/.test(node.tagName);
        node.childNodes.forEach((child) => walkInline(child, nextBold, nextItalic));
      };
      element.childNodes.forEach((child) => walkInline(child));
      flushBlock();
    };
    const walk = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches('hr.page-break')) { flushPage(); return; }
      if (/^(P|H1|H2|H3|H4)$/.test(node.tagName)) {
        processBlock(node);
        return;
      }
      node.childNodes.forEach(walk);
    };
    document.body.childNodes.forEach(walk);
    flushPage();
    const imported = pages.length ? pages : [{ id: newStoryId(), blocks: [newStoryBlock(document.body.textContent ?? '')] }];
    return groupStoryPagesByChapter(imported);
  }
  throw new Error('Choose a .txt, .md, or .docx file. Export Google Docs as a Word (.docx) file first.');
}
