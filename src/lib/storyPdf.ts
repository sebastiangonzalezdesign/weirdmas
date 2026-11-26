import type { PDFFont } from 'pdf-lib';
import { getStoryTextSegments, newStoryId, type StoryBlock, type StoryDocument, type StoryPage, type StoryBlockStyle, type StoryTextMark } from './storyDocument';

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 52;
const footerTop = 72;
const bodyTop = pageHeight - margin;
const fontSizeByStyle: Record<StoryBlockStyle, number> = { normal: 11.5, h1: 23, h2: 19, h3: 16, h4: 13.5 };

type Font = PDFFont;
type Fonts = { normal: Font; bold: Font; italic: Font; boldItalic: Font };
type TextRun = { text: string; bold: boolean; italic: boolean };
type TextLine = { runs: TextRun[] };

function flagsFont(bold: boolean, italic: boolean, fonts: Fonts): Font {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.normal;
}

function pdfText(value: string): string {
  return value.normalize('NFC').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function blockLines(block: StoryBlock, fonts: Fonts): TextLine[] {
  const size = fontSizeByStyle[block.style]; const width = pageWidth - margin * 2;
  const source = pdfText(block.text);
  const segments = getStoryTextSegments({ ...block, text: source });
  const chars: { value: string; bold: boolean; italic: boolean }[] = [];
  for (const segment of segments) for (const value of segment.text) chars.push({ value, bold: segment.bold || block.style !== 'normal', italic: segment.italic });
  const lines: TextLine[] = [];
  let current: TextRun[] = [];
  const currentWidth = () => current.reduce((sum, run) => sum + flagsFont(run.bold, run.italic, fonts).widthOfTextAtSize(run.text, size), 0);
  const append = (value: string, bold: boolean, italic: boolean) => {
    const last = current.at(-1);
    if (last && last.bold === bold && last.italic === italic) last.text += value;
    else current.push({ text: value, bold, italic });
  };
  const flush = () => { while (current.length && /^\s+$/.test(current.at(-1)?.text ?? '')) current.pop(); lines.push({ runs: current }); current = []; };
  let index = 0;
  while (index < chars.length) {
    const char = chars[index]; if (!char) { index += 1; continue; }
    if (char.value === '\n') { flush(); index += 1; continue; }
    if (/\s/.test(char.value)) { if (current.length && !/^\s+$/.test(current.at(-1)?.text ?? '')) append(' ', char.bold, char.italic); index += 1; continue; }
    let end = index;
    while (end < chars.length && chars[end] && !/\s/.test(chars[end]!.value)) end += 1;
    const word = chars.slice(index, end);
    const wordRuns: TextRun[] = [];
    for (const item of word) { const last = wordRuns.at(-1); if (last && last.bold === item.bold && last.italic === item.italic) last.text += item.value; else wordRuns.push({ text: item.value, bold: item.bold, italic: item.italic }); }
    const wordWidth = wordRuns.reduce((sum, run) => sum + flagsFont(run.bold, run.italic, fonts).widthOfTextAtSize(run.text, size), 0);
    if (current.length && currentWidth() + wordWidth > width) flush();
    if (wordWidth <= width) wordRuns.forEach((run) => append(run.text, run.bold, run.italic));
    else for (const item of word) { const value = item.value; const before = currentWidth(); if (current.length && before + flagsFont(item.bold, item.italic, fonts).widthOfTextAtSize(value, size) > width) flush(); append(value, item.bold, item.italic); }
    index = end;
  }
  if (current.length || !lines.length) flush();
  return lines;
}

function blockHeight(block: StoryBlock, lineCount: number): number {
  return lineCount * fontSizeByStyle[block.style] * 1.35 + (block.style === 'normal' ? 8 : 10);
}

function linesToBlock(block: StoryBlock, lines: TextLine[], id = block.id): StoryBlock {
  const text = lines.map((line) => line.runs.map((run) => run.text).join('')).join('\n');
  const marks: StoryTextMark[] = [];
  let offset = 0;
  for (const line of lines) {
    for (const run of line.runs) {
      if (run.bold !== block.bold || run.italic !== block.italic) {
        const previous = marks.at(-1);
        if (previous && previous.end === offset && previous.bold === run.bold && previous.italic === run.italic) previous.end += run.text.length;
        else marks.push({ start: offset, end: offset + run.text.length, bold: run.bold, italic: run.italic });
      }
      offset += run.text.length;
    }
    offset += 1;
  }
  return { ...block, id, text, marks };
}

function splitBlock(block: StoryBlock, lines: TextLine[], maxHeight: number): [StoryBlock, StoryBlock | null] {
  const lineHeight = fontSizeByStyle[block.style] * 1.35;
  const count = Math.max(1, Math.floor((maxHeight - 8) / lineHeight));
  return [
    linesToBlock(block, lines.slice(0, count)),
    lines.length > count ? linesToBlock(block, lines.slice(count), newStoryId()) : null,
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
        const lines = blockLines(pending, fonts);
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
        const lines = blockLines(block, fonts);
        for (const line of lines) {
          let x = margin;
          for (const run of line.runs) {
            const font = flagsFont(run.bold || block.style !== 'normal', run.italic, fonts);
            page.drawText(pdfText(run.text), { x, y, size, font, color: rgb(0.12, 0.16, 0.19) });
            x += font.widthOfTextAtSize(pdfText(run.text), size);
          }
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
