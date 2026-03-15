import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DOC_SECTIONS, DOC_TITLE } from "@/lib/docs/content";

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line: string[] = [];

  for (const w of words) {
    const next = [...line, w].join(" ");
    if (next.length > maxChars) {
      if (line.length) lines.push(line.join(" "));
      line = [w];
    } else {
      line.push(w);
    }
  }
  if (line.length) lines.push(line.join(" "));
  return lines;
}

export async function GET() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 48;
  const fontSize = 10.5;
  const lineH = 14;

  let page = pdf.addPage(pageSize);
  let y = page.getHeight() - margin;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = page.getHeight() - margin;
  };

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number; color?: { r: number; g: number; b: number } }) => {
    const size = opts?.size ?? fontSize;
    const f = opts?.bold ? fontBold : font;
    const c = opts?.color ?? { r: 0.55, g: 0.58, b: 0.62 };
    if (y < margin + lineH) newPage();
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(c.r, c.g, c.b),
    });
    y -= lineH;
  };

  // Title
  drawLine(DOC_TITLE, { bold: true, size: 16, color: { r: 0.90, g: 0.93, b: 0.95 } });
  y -= 6;
  drawLine(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, { size: 9.5, color: { r: 0.55, g: 0.58, b: 0.62 } });
  y -= 10;

  for (const s of DOC_SECTIONS) {
    if (y < margin + lineH * 4) newPage();
    drawLine(s.title, { bold: true, size: 13, color: { r: 0.90, g: 0.93, b: 0.95 } });
    y -= 2;

    for (const b of s.blocks) {
      if (b.type === "p") {
        for (const ln of wrapText(b.text, 95)) {
          drawLine(ln);
        }
        y -= 4;
      } else if (b.type === "ul") {
        for (const item of b.items) {
          const lines = wrapText(item, 90);
          lines.forEach((ln, idx) => drawLine(`${idx === 0 ? "• " : "  "}${ln}`));
        }
        y -= 4;
      } else if (b.type === "note") {
        drawLine(`${b.title}:`, { bold: true, color: { r: 0.96, g: 0.62, b: 0.11 } });
        for (const ln of wrapText(b.text, 95)) {
          drawLine(ln);
        }
        y -= 4;
      }
    }

    y -= 8;
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AgileAllView-Documentacao.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
