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
  const words = pdfText(value).split(/\s+/).filter(Boolean).flatMap((word) => {
    if (font.widthOfTextAtSize(word, size) <= width) return [word];
    const parts: string[] = [];
    let part = '';
    for (const character of word) {
      if (part && font.widthOfTextAtSize(part + character, size) > width) {
        parts.push(part);
        part = character;
      } else part += character;
    }
    if (part) parts.push(part);
    return parts;
  });
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
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

export async function createStoryPdf(content: string, cover?: File | null): Promise<Blob> {
  if (!content.trim()) throw new Error('Add some story text before creating its PDF.');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Weirdmas — The Story');
  pdf.setSubject('Weirdmas December story');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  if (cover) {
    const image = await pdf.embedJpg(await coverJpeg(cover));
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText('WEIRDMAS', { x: margin, y: pageHeight - 70, size: 26, font: bold, color: rgb(0.043, 0.09, 0.129) });
    const frame = { x: margin, y: 120, width: pageWidth - margin * 2, height: pageHeight - 240 };
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height });
  }

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const startPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText('WEIRDMAS · THE STORY', { x: margin, y, size: 9, font: bold, color: rgb(0.32, 0.39, 0.45) });
    y -= 28;
  };
  page.drawText('The Story', { x: margin, y, size: 26, font: bold, color: rgb(0.043, 0.09, 0.129) });
  y -= 38;
  for (const paragraph of content.replace(/\r\n/g, '\n').split('\n')) {
    const lines = wrapLine(paragraph, regular, 12, pageWidth - margin * 2);
    for (const line of lines) {
      if (y < margin + 20) startPage();
      page.drawText(line, { x: margin, y, size: 12, font: regular, color: rgb(0.12, 0.16, 0.19) });
      y -= 18;
    }
    y -= 7;
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
