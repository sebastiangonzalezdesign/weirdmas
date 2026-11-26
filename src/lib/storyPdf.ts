import type { PDFFont } from 'pdf-lib';
import { newStoryId, type StoryBlock, type StoryDocument, type StoryPage, type StoryBlockStyle } from './storyDocument';

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 52;
const footerTop = 72;
const bodyTop = pageHeight - margin;
const fontSizeByStyle: Record<StoryBlockStyle, number> = { normal: 11.5, h1: 23, h2: 19, h3: 16, h4: 13.5 };

type Font = PDFFont;
type Fonts = { normal: Font; bold: Font; italic: Font; boldItalic: Font };

function blockFont(block: StoryBlock, fonts: Fonts): Font {
  const bold = block.bold || block.style !== 'normal';
  if (bold && block.italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (block.italic) return fonts.italic;
  return fonts.normal;
}

function pdfText(value: string): string {
  return value.normalize('NFC').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function wrapLine(value: string, font: Font, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of pdfText(value).split(/\s+/).filter(Boolean)) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (line) { lines.push(line); line = ''; }
      let fragment = '';
      for (const character of word) {
        if (fragment && font.widthOfTextAtSize(fragment + character, size) > width) {
          lines.push(fragment);
          fragment = character;
        } else fragment += character;
      }
      line = fragment;
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function getLines(block: StoryBlock, fonts: Fonts): string[] {
  return block.text.replace(/\r\n/g, '\n').split('\n').flatMap((paragraph) => wrapLine(
    paragraph,
    blockFont(block, fonts),
    fontSizeByStyle[block.style],
    pageWidth - margin * 2,
  ));
}

function blockHeight(block: StoryBlock, lineCount: number): number {
  return lineCount * fontSizeByStyle[block.style] * 1.35 + (block.style === 'normal' ? 8 : 10);
}

function splitBlock(block: StoryBlock, lines: string[], maxHeight: number): [StoryBlock, StoryBlock | null] {
  const lineHeight = fontSizeByStyle[block.style] * 1.35;
  const count = Math.max(1, Math.floor((maxHeight - 8) / lineHeight));
  return [
    { ...block, text: lines.slice(0, count).join('\n') },
    lines.length > count ? { ...block, id: newStoryId(), text: lines.slice(count).join('\n') } : null,
  ];
}

export async function paginateStoryDocument(document: StoryDocument): Promise<StoryDocument> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const measuringDocument = await PDFDocument.create();
  const fonts: Fonts = {
    normal: await measuringDocument.embedFont(StandardFonts.Helvetica),
    bold: await measuringDocument.embedFont(StandardFonts.HelveticaBold),
    italic: await measuringDocument.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await measuringDocument.embedFont(StandardFonts.HelveticaBoldOblique),
  };

  return document.map((chapter) => {
    const pages: StoryPage[] = [];
    let pageBlocks: StoryBlock[] = [];
    let usedHeight = 0;
    let isFirstChapterPage = true;
    const flushPage = () => {
      pages.push({ id: newStoryId(), blocks: pageBlocks, chapterTitle: isFirstChapterPage ? chapter.title.trim() : '' });
      pageBlocks = [];
      usedHeight = 0;
      isFirstChapterPage = false;
    };
    const addBlock = (block: StoryBlock) => {
      let pending: StoryBlock | null = block;
      while (pending) {
        const lines = getLines(pending, fonts);
        const height = blockHeight(pending, lines.length);
        const maxHeight = bodyTop - footerTop;
        if (usedHeight + height <= maxHeight) {
          pageBlocks.push(pending);
          usedHeight += height;
          pending = null;
          continue;
        }
        const remaining = maxHeight - usedHeight;
        if (pageBlocks.length > 0 && remaining > fontSizeByStyle[pending.style] * 1.35) {
          const [fittingBlock, rest] = splitBlock(pending, lines, remaining);
          pageBlocks.push(fittingBlock);
          flushPage();
          pending = rest;
        } else if (pageBlocks.length > 0) {
          flushPage();
        } else {
          const [fittingBlock, rest] = splitBlock(pending, lines, maxHeight - usedHeight);
          pageBlocks.push(fittingBlock);
          flushPage();
          pending = rest;
        }
      }
    };

    chapter.pages.forEach((sourcePage, pageIndex) => {
      if (pageIndex > 0 && pageBlocks.length > 0) flushPage();
      if (isFirstChapterPage && chapter.title.trim()) usedHeight = fontSizeByStyle.h2 * 1.35 + 10;
      sourcePage.blocks.forEach((block) => { if (block.text.trim()) addBlock(block); });
    });
    if (pageBlocks.length > 0 || pages.length === 0) flushPage();
    return { ...chapter, pages };
  });
}

async function coverJpeg(file: File): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The browser could not prepare the cover image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The cover image could not be encoded.')), 'image/jpeg', 0.9));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createStoryPdf(document: StoryDocument, cover?: File | null): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Weirdmas Story');
  pdf.setSubject('Weirdmas December story');
  const fonts: Fonts = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  let pageNumber = 0;
  const drawPageNumber = (page: ReturnType<typeof pdf.addPage>) => {
    page.drawText(String(pageNumber).padStart(2, '0'), {
      x: pageWidth - margin - 18,
      y: 43,
      size: 9,
      font: fonts.normal,
      color: rgb(0.31, 0.37, 0.42),
    });
  };

  if (cover) {
    const image = await pdf.embedJpg(await coverJpeg(cover));
    const page = pdf.addPage([pageWidth, pageHeight]);
    const frame = { x: margin, y: margin, width: pageWidth - margin * 2, height: pageHeight - margin * 2 };
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height });
    pageNumber += 1;
    drawPageNumber(page);
  }

  for (const chapter of document) {
    for (const storyPage of chapter.pages) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      let y = bodyTop;
      if (storyPage.chapterTitle?.trim()) {
        const titleSize = fontSizeByStyle.h2;
        page.drawText(pdfText(storyPage.chapterTitle.trim()), { x: margin, y, size: titleSize, font: fonts.bold, color: rgb(0.043, 0.09, 0.129) });
        y -= titleSize * 1.35 + 10;
      }
      for (const block of storyPage.blocks) {
        const size = fontSizeByStyle[block.style];
        const lines = getLines(block, fonts);
        const font = blockFont(block, fonts);
        for (const line of lines) {
          page.drawText(pdfText(line), { x: margin, y, size, font, color: rgb(0.12, 0.16, 0.19) });
          y -= size * 1.35;
        }
        y -= block.style === 'normal' ? 8 : 10;
      }
      pageNumber += 1;
      drawPageNumber(page);
    }
  }

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
