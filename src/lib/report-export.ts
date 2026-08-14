export type ReportColumn = { header: string; align?: "left" | "right" };

export type ReportData = {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: (string | number)[][];
  /** Optional summary lines printed under the table. */
  summary?: string[];
};

const GREEN: [number, number, number] = [38, 66, 48];
const GOLD: [number, number, number] = [176, 137, 60];

function stamp() {
  return new Date().toLocaleString("pt-BR");
}

function fileName(title: string, ext: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `fazenda-scott-${slug}-${date}.${ext}`;
}

export async function exportReportPdf(data: ReportData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, width, 70, "F");
  doc.setTextColor(245, 240, 225);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Fazenda Scott", 40, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${data.title}${data.subtitle ? ` — ${data.subtitle}` : ""}`, 40, 54);
  doc.setFontSize(9);
  doc.text(`Gerado em ${stamp()}`, width - 40, 54, { align: "right" });

  autoTable(doc, {
    startY: 90,
    head: [data.columns.map((c) => c.header)],
    body: data.rows.map((r) => r.map((c) => String(c))),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: GOLD, textColor: [30, 30, 25], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 243, 232] },
    columnStyles: Object.fromEntries(
      data.columns.map((c, i) => [i, { halign: c.align ?? "left" }]),
    ),
    margin: { left: 40, right: 40 },
  });

  if (data.summary?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let y = ((doc as any).lastAutoTable?.finalY ?? 90) + 24;
    doc.setTextColor(40, 40, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    for (const line of data.summary) {
      doc.text(line, 40, y);
      y += 16;
    }
  }

  doc.save(fileName(data.title, "pdf"));
}

/** Renders a DOM node to a PNG download. */
export async function exportNodePng(node: HTMLElement, title: string) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    backgroundColor: "#faf7ec",
    scale: 2,
    useCORS: true,
  });
  const link = document.createElement("a");
  link.download = fileName(title, "png");
  link.href = canvas.toDataURL("image/png");
  link.click();
}
