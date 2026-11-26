export type StoryBlockStyle = 'normal' | 'h1' | 'h2' | 'h3' | 'h4';

export interface StoryBlock {
  id: string;
  text: string;
  style: StoryBlockStyle;
  bold: boolean;
  italic: boolean;
}

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

export function newStoryPage(text = ''): StoryPage {
  const paragraphs = text.split('\n\n').filter(Boolean);
  return { id: newStoryId(), blocks: paragraphs.length ? paragraphs.map((paragraph) => newStoryBlock(paragraph)) : [newStoryBlock()] };
}

export function newStoryChapter(title = ''): StoryChapter {
  return { id: newStoryId(), title, pages: [newStoryPage()] };
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
  const chapter = newStoryChapter('');
  chapter.pages = sections.map((section) => {
    const paragraphs = section.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    return { id: newStoryId(), blocks: paragraphs.length ? paragraphs.map((paragraph) => newStoryBlock(paragraph.trim())) : [newStoryBlock()] };
  });
  return [chapter];
}
