export type StoryBlockStyle = 'normal' | 'h1' | 'h2' | 'h3' | 'h4';

export interface StoryBlock {
  id: string;
  text: string;
  style: StoryBlockStyle;
  bold: boolean;
  italic: boolean;
  marks?: StoryTextMark[];
}

export interface StoryTextMark { start: number; end: number; bold: boolean; italic: boolean }
export interface StoryTextSegment { text: string; bold: boolean; italic: boolean }

export interface StoryPage {
  id: string;
  blocks: StoryBlock[];
  chapterTitle?: string;
}

export interface StoryChapter {
  id: string;
  title: string;
  pages: StoryPage[];
}

export type StoryDocument = StoryChapter[];

const documentMarker = 'WEIRDMAS_STORY_V2\n';

export function newStoryId(): string {
  return crypto.randomUUID();
}

export function newStoryBlock(text = '', style: StoryBlockStyle = 'normal'): StoryBlock {
  return { id: newStoryId(), text, style, bold: false, italic: false };
}

export function getStoryTextSegments(block: StoryBlock): StoryTextSegment[] {
  if (!block.text) return [];
  const points = new Set([0, block.text.length]);
  for (const mark of block.marks ?? []) { points.add(Math.max(0, Math.min(block.text.length, mark.start))); points.add(Math.max(0, Math.min(block.text.length, mark.end))); }
  const sorted = [...points].sort((a, b) => a - b);
  const segments: StoryTextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i]; const end = sorted[i + 1];
    if (start === undefined || end === undefined || end <= start) continue;
    const mark = (block.marks ?? []).find((item) => item.start <= start && item.end >= end);
    const segment = { text: block.text.slice(start, end), bold: mark?.bold ?? block.bold, italic: mark?.italic ?? block.italic };
    const previous = segments.at(-1);
    if (previous && previous.bold === segment.bold && previous.italic === segment.italic) previous.text += segment.text;
    else segments.push(segment);
  }
  return segments;
}

export function formatStoryBlock(block: StoryBlock, start: number, end: number, format: 'bold' | 'italic'): StoryBlock {
  const from = Math.max(0, Math.min(block.text.length, start)); const to = Math.max(from, Math.min(block.text.length, end));
  if (to <= from) return block;
  const points = new Set([0, block.text.length, from, to]);
  for (const mark of block.marks ?? []) { points.add(mark.start); points.add(mark.end); }
  const sorted = [...points].sort((a, b) => a - b);
  const segments: StoryTextMark[] = [];
  const selectedSegments = sorted.slice(0, -1).map((segmentStart, index) => {
    const segmentEnd = sorted[index + 1] ?? segmentStart;
    const oldMark = (block.marks ?? []).find((mark) => mark.start <= segmentStart && mark.end >= segmentEnd);
    return { start: segmentStart, end: segmentEnd, bold: oldMark?.bold ?? block.bold, italic: oldMark?.italic ?? block.italic, selected: segmentStart >= from && segmentEnd <= to };
  });
  const shouldEnable = selectedSegments.some((segment) => segment.selected && !segment[format]);
  for (const segment of selectedSegments) {
    const value = { bold: segment.bold, italic: segment.italic };
    if (segment.selected) value[format] = shouldEnable;
    if (value.bold === block.bold && value.italic === block.italic) continue;
    const previous = segments.at(-1);
    if (previous && previous.end === segment.start && previous.bold === value.bold && previous.italic === value.italic) previous.end = segment.end;
    else segments.push({ start: segment.start, end: segment.end, ...value });
  }
  return { ...block, marks: segments };
}

export function isStoryRangeFormatted(block: StoryBlock, start: number, end: number, format: 'bold' | 'italic'): boolean {
  const from = Math.max(0, Math.min(block.text.length, start)); const to = Math.max(from, Math.min(block.text.length, end));
  if (to <= from) return false;
  const points = new Set([from, to]);
  for (const mark of block.marks ?? []) { if (mark.start > from && mark.start < to) points.add(mark.start); if (mark.end > from && mark.end < to) points.add(mark.end); }
  const sorted = [...points].sort((a, b) => a - b);
  return sorted.slice(0, -1).every((segmentStart, index) => {
    const segmentEnd = sorted[index + 1] ?? segmentStart;
    const mark = (block.marks ?? []).find((item) => item.start <= segmentStart && item.end >= segmentEnd);
    return mark?.[format] ?? block[format];
  });
}

export function adjustStoryBlockText(block: StoryBlock, text: string): StoryBlock {
  if (!block.marks?.length || text === block.text) return { ...block, text };
  let prefix = 0;
  while (prefix < block.text.length && prefix < text.length && block.text[prefix] === text[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < block.text.length - prefix && suffix < text.length - prefix && block.text[block.text.length - 1 - suffix] === text[text.length - 1 - suffix]) suffix += 1;
  const oldEnd = block.text.length - suffix; const newEnd = text.length - suffix; const delta = newEnd - oldEnd;
  const marks: StoryTextMark[] = [];
  for (const mark of block.marks) {
    if (mark.start < prefix) marks.push({ ...mark, end: Math.min(mark.end, prefix) });
    if (mark.end > oldEnd) marks.push({ ...mark, start: Math.max(mark.start, oldEnd) + delta, end: mark.end + delta });
  }
  return { ...block, text, marks: marks.filter((mark) => mark.end > mark.start).sort((a, b) => a.start - b.start) };
}

export function newStoryPage(text = ''): StoryPage {
  const paragraphs = text.split('\n\n').filter(Boolean);
  return { id: newStoryId(), blocks: paragraphs.length ? paragraphs.map((paragraph) => newStoryBlock(paragraph)) : [newStoryBlock()] };
}

export function newStoryChapter(title = ''): StoryChapter {
  return { id: newStoryId(), title, pages: [newStoryPage()] };
}

export function groupStoryPagesByChapter(pages: StoryPage[]): StoryDocument {
  const chapters: StoryDocument = [];
  let chapter = newStoryChapter('');
  chapter.pages = [];
  let pageBlocks: StoryBlock[] = [];
  let chapterHasContent = false;
  const flushPage = () => {
    if (!pageBlocks.length) return;
    chapter.pages.push({ id: newStoryId(), blocks: pageBlocks });
    pageBlocks = [];
  };
  const flushChapter = () => {
    flushPage();
    if (chapterHasContent || chapter.pages.length) chapters.push(chapter);
    chapter = newStoryChapter('');
    chapter.pages = [];
    chapterHasContent = false;
  };
  for (const page of pages) {
    for (const block of page.blocks) {
      const heading = block.text.trim().match(/^#{0,6}\s*(chapter\b[^\n]*)$/i);
      if (heading?.[1]) {
        flushChapter();
        chapter.title = heading[1].replace(/^#+\s*/, '').trim();
        chapterHasContent = true;
      } else {
        pageBlocks.push(block);
        if (block.text.trim()) chapterHasContent = true;
      }
    }
    flushPage();
  }
  flushChapter();
  if (!chapters.length) {
    const fallback = newStoryChapter('');
    fallback.pages = pages.length ? pages : [newStoryPage()];
    return [fallback];
  }
  return chapters;
}

export function serializeStoryDocument(document: StoryDocument): string {
  return `${documentMarker}${JSON.stringify({ version: 2, chapters: document })}`;
}

function isStoryBlockStyle(value: unknown): value is StoryBlockStyle {
  return value === 'normal' || value === 'h1' || value === 'h2' || value === 'h3' || value === 'h4';
}

export function parseStoryDocument(value: string): StoryDocument {
  if (value.startsWith(documentMarker)) {
    try {
      const parsed: unknown = JSON.parse(value.slice(documentMarker.length));
      if (typeof parsed === 'object' && parsed !== null && 'chapters' in parsed && Array.isArray(parsed.chapters)) {
        const chapters = parsed.chapters.flatMap((rawChapter: unknown): StoryChapter[] => {
          if (typeof rawChapter !== 'object' || rawChapter === null) return [];
          const chapter = rawChapter as Partial<StoryChapter>;
          if (typeof chapter.title !== 'string' || !Array.isArray(chapter.pages)) return [];
          const pages = chapter.pages.flatMap((rawPage): StoryPage[] => {
            if (typeof rawPage !== 'object' || rawPage === null || !('blocks' in rawPage) || !Array.isArray(rawPage.blocks)) return [];
            const blocks = rawPage.blocks.flatMap((rawBlock): StoryBlock[] => {
              if (typeof rawBlock !== 'object' || rawBlock === null || !('text' in rawBlock) || typeof rawBlock.text !== 'string') return [];
              const block = rawBlock as Partial<StoryBlock>;
              return [{
                id: typeof block.id === 'string' ? block.id : newStoryId(),
                text: block.text ?? '',
                style: isStoryBlockStyle(block.style) ? block.style : 'normal',
                bold: block.bold === true,
                italic: block.italic === true,
                marks: Array.isArray(block.marks) ? block.marks.filter((mark): mark is StoryTextMark => typeof mark === 'object' && mark !== null && typeof mark.start === 'number' && typeof mark.end === 'number' && typeof mark.bold === 'boolean' && typeof mark.italic === 'boolean') : [],
              }];
            });
            return [{ id: typeof rawPage.id === 'string' ? rawPage.id : newStoryId(), blocks: blocks.length ? blocks : [newStoryBlock()] }];
          });
          return [{ id: typeof chapter.id === 'string' ? chapter.id : newStoryId(), title: chapter.title, pages: pages.length ? pages : [newStoryPage()] }];
        });
        if (chapters.length) return chapters;
      }
    } catch {
      // Treat malformed saved data as plain text below.
    }
  }

  const sections = value.replace(/\r\n/g, '\n').split('\f');
  const pages = sections.map((section) => {
    const paragraphs = section.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    const blocks = paragraphs.map((paragraph) => {
      const heading = paragraph.trim().match(/^(#{1,4})\s+([\s\S]+)$/);
      return newStoryBlock(heading?.[2] ?? paragraph.trim(), heading ? `h${heading[1]?.length}` as StoryBlockStyle : 'normal');
    });
    return { id: newStoryId(), blocks: blocks.length ? blocks : [newStoryBlock()] };
  });
  return groupStoryPagesByChapter(pages);
}
