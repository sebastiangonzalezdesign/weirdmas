import * as mammoth from 'mammoth';
import { newStoryBlock, newStoryChapter, newStoryId, newStoryPage, parseStoryDocument, type StoryBlockStyle, type StoryChapter, type StoryPage } from './storyDocument';

function importedBlock(element: Element) {
  const tag = element.tagName.toLowerCase();
  const style: StoryBlockStyle = /^h[1-4]$/.test(tag) ? tag as StoryBlockStyle : 'normal';
  const hasBold = Boolean(element.querySelector('strong,b'));
  const hasItalic = Boolean(element.querySelector('em,i'));
  const block = newStoryBlock(element.textContent?.trim() ?? '', style);
  block.bold = hasBold;
  block.italic = hasItalic;
  return block;
}

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
    const chapter = newStoryChapter('');
    let blocks: ReturnType<typeof importedBlock>[] = [];
    const pages: StoryPage[] = [];
    const flushPage = () => {
      if (blocks.length) pages.push({ id: newStoryId(), blocks });
      blocks = [];
    };
    const walk = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches('hr.page-break')) { flushPage(); return; }
      if (/^(P|H1|H2|H3|H4)$/.test(node.tagName)) {
        const block = importedBlock(node);
        if (block.text) blocks.push(block);
        return;
      }
      node.childNodes.forEach(walk);
    };
    document.body.childNodes.forEach(walk);
    flushPage();
    chapter.pages = pages.length ? pages : [newStoryPage(document.body.textContent ?? '')];
    return [chapter];
  }
  throw new Error('Choose a .txt, .md, or .docx file. Export Google Docs as a Word (.docx) file first.');
}
