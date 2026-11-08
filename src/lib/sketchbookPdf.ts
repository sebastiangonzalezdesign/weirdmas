import type { Drawing } from '../components/Gallery';
import type { Participant } from '../data/participants';
import { formatChallengeDate } from './challenge';
import { downloadDrawing, type PromptAssignment } from './supabaseApi';

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 44;
const imageFrame = {
  x: margin,
  y: 142,
  width: pageWidth - margin * 2,
  height: pageHeight - 370,
};

function pdfSafeText(value: string): string {
  return value.normalize('NFC').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function fitText(value: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number): string {
  const text = pdfSafeText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 0 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
}

async function imageAsJpegBytes(blob: Blob): Promise<Uint8Array> {
  const imageUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('An uploaded image could not be decoded.');

    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The browser could not prepare an image for the PDF.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('The browser could not encode an image for the PDF.'));
      }, 'image/jpeg', 0.9);
    });
    return new Uint8Array(await jpeg.arrayBuffer());
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function createSketchbookPdf(
  drawings: Drawing[],
  participant: Participant,
  prompts: PromptAssignment[],
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (drawings.length === 0) throw new Error('Select at least one drawing to export.');

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  document.setTitle(`${pdfSafeText(participant.name)}'s Weirdmas Sketchbook`);
  document.setAuthor(pdfSafeText(participant.name));
  document.setSubject('Weirdmas December 2026 drawing challenge');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const promptByDay = new Map(prompts.map((prompt) => [prompt.day, prompt.title]));
  const countByDay = new Map<number, number>();
  for (const drawing of drawings) {
    countByDay.set(drawing.day, (countByDay.get(drawing.day) ?? 0) + 1);
  }
  const positionByDay = new Map<number, number>();
  const orderedDrawings = [...drawings].sort((first, second) => first.day - second.day);

  for (const [index, drawing] of orderedDrawings.entries()) {
    onProgress?.(index + 1, orderedDrawings.length);
    const imageBlob = await downloadDrawing(drawing.storagePath);
    const imageBytes = await imageAsJpegBytes(imageBlob);
    const image = await document.embedJpg(imageBytes);
    const page = document.addPage([pageWidth, pageHeight]);
    const navy = rgb(0.043, 0.09, 0.129);
    const muted = rgb(0.31, 0.37, 0.42);
    const paper = rgb(0.96, 0.96, 0.94);
    const lightLine = rgb(0.85, 0.87, 0.88);

    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
    page.drawRectangle({ x: 0, y: pageHeight - 84, width: pageWidth, height: 84, color: navy });
    page.drawText('WEIRDMAS', {
      x: margin,
      y: pageHeight - 43,
      size: 22,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('DECEMBER 2026 DRAWING CHALLENGE', {
      x: margin,
      y: pageHeight - 64,
      size: 9,
      font: regular,
      color: rgb(0.78, 0.82, 0.86),
    });

    const dayLabel = `DAY ${String(drawing.day).padStart(2, '0')}`;
    const dateLabel = `${formatChallengeDate(drawing.day)}, 2026`.toUpperCase();
    const prompt = pdfSafeText(promptByDay.get(drawing.day) ?? 'Daily drawing');
    page.drawText(dayLabel, {
      x: margin,
      y: pageHeight - 126,
      size: 11,
      font: bold,
      color: rgb(0.85, 0.25, 0.25),
    });
    page.drawText(dateLabel, {
      x: margin,
      y: pageHeight - 145,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawText(fitText(prompt, bold, 25, pageWidth - margin * 2), {
      x: margin,
      y: pageHeight - 181,
      size: 25,
      font: bold,
      color: navy,
    });

    page.drawRectangle({
      ...imageFrame,
      color: rgb(1, 1, 1),
      borderColor: lightLine,
      borderWidth: 1,
    });
    const imageScale = Math.min(imageFrame.width / image.width, imageFrame.height / image.height);
    const imageWidth = image.width * imageScale;
    const imageHeight = image.height * imageScale;
    page.drawImage(image, {
      x: imageFrame.x + (imageFrame.width - imageWidth) / 2,
      y: imageFrame.y + (imageFrame.height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    });

    const imageNumber = (positionByDay.get(drawing.day) ?? 0) + 1;
    positionByDay.set(drawing.day, imageNumber);
    const imageCount = countByDay.get(drawing.day) ?? 1;
    page.drawLine({
      start: { x: margin, y: 91 },
      end: { x: pageWidth - margin, y: 91 },
      thickness: 1,
      color: lightLine,
    });
    page.drawText(pdfSafeText(participant.name), {
      x: margin,
      y: 67,
      size: 10,
      font: bold,
      color: navy,
    });
    const footer = `IMAGE ${imageNumber} OF ${imageCount}  |  PAGE ${index + 1} OF ${orderedDrawings.length}`;
    const footerWidth = regular.widthOfTextAtSize(footer, 9);
    page.drawText(footer, {
      x: pageWidth - margin - footerWidth,
      y: 67,
      size: 9,
      font: regular,
      color: muted,
    });
  }

  const bytes = await document.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
