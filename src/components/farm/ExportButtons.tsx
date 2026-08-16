import { useState } from "react";
import { FileDown, Image as ImageIcon, Sheet } from "lucide-react";
import { toast } from "sonner";
import {
  exportNodePng,
  exportReportPdf,
  exportReportXlsx,
  type ReportData,
} from "@/lib/report-export";

type Kind = "pdf" | "png" | "xlsx";

export function ExportButtons({
  report,
  targetRef,
}: {
  report: () => ReportData;
  targetRef?: React.RefObject<HTMLElement | null>;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);

  const run = async (kind: Kind) => {
    setBusy(kind);
    try {
      const data = report();
      if (kind === "pdf") {
        if (!data.rows.length) throw new Error("Nada para exportar ainda.");
        await exportReportPdf(data);
      } else if (kind === "xlsx") {
        if (!data.rows.length) throw new Error("Nada para exportar ainda.");
        await exportReportXlsx(data);
      } else {
        const node = targetRef?.current;
        if (!node) throw new Error("Nada para exportar ainda.");
        await exportNodePng(node, data.title);
      }
      toast.success(`Relatório exportado em ${kind.toUpperCase()}!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => run("pdf")}
        disabled={busy !== null}
        className="btn-outline hover-lift"
        title="Exportar relatório em PDF"
      >
        <FileDown className="h-4 w-4" />
        {busy === "pdf" ? "Gerando..." : "PDF"}
      </button>
      <button
        onClick={() => run("xlsx")}
        disabled={busy !== null}
        className="btn-outline hover-lift"
        title="Exportar relatório em Excel"
      >
        <Sheet className="h-4 w-4" />
        {busy === "xlsx" ? "Gerando..." : "Excel"}
      </button>
      <button
        onClick={() => run("png")}
        disabled={busy !== null}
        className="btn-outline hover-lift"
        title="Exportar relatório em PNG"
      >
        <ImageIcon className="h-4 w-4" />
        {busy === "png" ? "Gerando..." : "PNG"}
      </button>
    </div>
  );
}
