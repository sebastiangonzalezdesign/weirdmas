const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 52;

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

function pdfText(value: string): string {
  return value.normalize('NFC').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function wrapLine(value: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, width: number): string[] {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
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
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const bodySize = 11.5;
const lineHeight = 16;
const maxLinesPerPage = Math.floor((pageHeight - margin * 2 - 62) / lineHeight);

export async function paginateStoryText(content: string): Promise<string[]> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const measuringDocument = await PDFDocument.create();
  const font = await measuringDocument.embedFont(StandardFonts.Helvetica);
  const pages: string[] = [];
  let lines: string[] = [];
  const flushPage = () => {
    if (lines.length) pages.push(lines.join('\n'));
    lines = [];
  };
  const forcedSections = content.replace(/\r\n/g, '\n').split('\f');
  forcedSections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) flushPage();
    const paragraphs = section.split('\n');
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0 && paragraph.length === 0) {
        if (lines.length >= maxLinesPerPage) flushPage();
        lines.push('');
      } else if (paragraph.trim()) {
        for (const line of wrapLine(paragraph, font, bodySize, pageWidth - margin * 2)) {
          if (lines.length >= maxLinesPerPage) flushPage();
          lines.push(line);
        }
      }
    });
  });
  flushPage();
  return pages.length ? pages : [''];
}

export async function createStoryPdf(pages: string[], cover?: File | null): Promise<Blob> {
  if (!pages.some((page) => page.trim())) throw new Error('Add some story text before creating its PDF.');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Weirdmas — The Story');
  pdf.setSubject('Weirdmas December story');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const totalPages = pages.length + (cover ? 1 : 0);
  let pageNumber = 0;
  if (cover) {
    const image = await pdf.embedJpg(await coverJpeg(cover));
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText('WEIRDMAS', { x: margin, y: pageHeight - 70, size: 26, font: bold, color: rgb(0.043, 0.09, 0.129) });
    const frame = { x: margin, y: 120, width: pageWidth - margin * 2, height: pageHeight - 240 };
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height });
    pageNumber += 1;
    page.drawText(`COVER  ·  ${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`, { x: margin, y: 48, size: 9, font: regular, color: rgb(0.31, 0.37, 0.42) });
  }

  pages.forEach((pageContent, index) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    pageNumber += 1;
    page.drawText('WEIRDMAS', { x: margin, y: pageHeight - margin, size: 10, font: bold, color: rgb(0.043, 0.09, 0.129) });
    page.drawText(index === 0 ? 'THE STORY' : 'THE STORY · CONTINUED', { x: margin, y: pageHeight - margin - 18, size: 9, font: regular, color: rgb(0.31, 0.37, 0.42) });
    page.drawLine({ start: { x: margin, y: pageHeight - margin - 27 }, end: { x: pageWidth - margin, y: pageHeight - margin - 27 }, thickness: 1, color: rgb(0.85, 0.87, 0.88) });
    const firstBaseline = pageHeight - margin - 44;
    pageContent.split('\n').forEach((line, lineIndex) => {
      if (line) page.drawText(pdfText(line), { x: margin, y: firstBaseline - lineIndex * lineHeight, size: bodySize, font: regular, color: rgb(0.12, 0.16, 0.19) });
    });
    page.drawLine({ start: { x: margin, y: 64 }, end: { x: pageWidth - margin, y: 64 }, thickness: 1, color: rgb(0.85, 0.87, 0.88) });
    page.drawText(`PAGE ${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`, { x: margin, y: 44, size: 9, font: regular, color: rgb(0.31, 0.37, 0.42) });
  });
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
