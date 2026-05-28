import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  Send,
  HelpCircle,
} from "lucide-react";

interface AIAnalysisPanelProps {
  onRefreshTrigger?: () => void;
}

export default function AIAnalysisPanel({
  onRefreshTrigger,
}: AIAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAIAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch("/api/ai/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await resp.json();
      if (data.error && !data.analysis) {
        setErrorMsg(data.error);
      } else {
        setAnalysisText(data.analysis || "");
        if (data.error) {
          setErrorMsg(data.error); // Display warnings (e.g., API key missing)
        }
      }
    } catch (e: any) {
      setErrorMsg(
        `Terjadi kegagalan komunikasi dengan peladen: ${e?.message || e}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Safe and super clean native Markdown-esque text parser for government document style.
  const renderFormattedAnalysis = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        return (
          <h5
            key={idx}
            className="text-sm font-bold text-slate-900 mt-4 mb-2 first:mt-0 flex items-center gap-1.5 border-b pb-1 border-slate-100"
          >
            <span className="w-1.5 h-3.5 bg-blue-600 rounded-sm inline-block"></span>
            {trimmed.replace("### ", "")}
          </h5>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h4
            key={idx}
            className="text-base font-extrabold text-slate-900 mt-5 mb-2.5 flex items-center gap-2"
          >
            <span className="w-2 h-4 bg-blue-700 rounded-sm inline-block"></span>
            {trimmed.replace("## ", "")}
          </h4>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h3
            key={idx}
            className="text-lg font-extrabold text-blue-900 tracking-tight mt-6 mb-3 border-l-4 border-blue-600 pl-3 py-0.5"
          >
            {trimmed.replace("# ", "")}
          </h3>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const content = trimmed.substring(2);
        return (
          <li
            key={idx}
            className="text-xs text-slate-700 ml-4 mb-1.5 leading-relaxed list-disc"
          >
            {parseInlineStyles(content)}
          </li>
        );
      }
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote
            key={idx}
            className="border-l-4 border-amber-500 bg-amber-50/60 text-xs text-amber-900 p-2.5 my-2.5 rounded-r-md leading-relaxed font-medium"
          >
            {parseInlineStyles(trimmed.replace("> ", ""))}
          </blockquote>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-xs text-slate-600 leading-relaxed mb-1.5">
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Processes **bold text** inside strings
  const parseInlineStyles = (content: string) => {
    const parts = content.split("**");
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      id="ai-inflation-advisor"
      className="bg-[#111827] text-white rounded border border-[#1f2937] shadow-sm overflow-hidden"
    >
      {/* Panel Header */}
      <div className="p-4 md:p-5 border-b border-[#1f2937] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[9px] font-bold uppercase tracking-wider">
                Rekomendasi Kebijakan
              </span>
              <span className="text-[10px] text-gray-400">
                Powered by Inflasi AI
              </span>
            </div>
            <h3 className="text-xs font-bold text-white mt-1 leading-tight uppercase tracking-wider">
              Analis Kebijakan Pengendalian Inflasi (Smart TPID)
            </h3>
          </div>
        </div>

        <button
          onClick={fetchAIAnalysis}
          disabled={loading}
          className="relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white text-xs font-bold rounded transition cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-200" />
              <span>Menganalisis Harga...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>
                {analysisText ? "Evaluasi Ulang Data" : "Jalankan Analisis AI"}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Warnings & Content View */}
      <div className="p-4 md:p-5 bg-gray-950 text-left">
        {errorMsg && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded text-xs leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-200 mb-0.5">
                Catatan Sistem:
              </span>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-3" />
            <span className="text-slate-200 font-semibold text-sm">
              Menghubungkan ke TPID Analis AI...
            </span>
            <p className="text-[11px] text-slate-400 mt-1.5 max-w-sm leading-relaxed">
              Inflasi AI sedang meninjau database komoditi Pasar Induk Mentok,
              membandingkan ketetapan HET, menghitung momentum fluktuasi, dan
              merumuskan agenda intervensi pasar yang direkomendasikan...
            </p>
          </div>
        ) : analysisText ? (
          <div className="bg-white text-slate-800 p-5 rounded border border-gray-200 shadow-inner max-h-[480px] overflow-y-auto">
            {renderFormattedAnalysis(analysisText)}
          </div>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-gray-800 rounded bg-gray-950/20">
            <FileText className="w-12 h-12 text-slate-600 mb-2.5 stroke-[1.2]" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Laporan Intervensi Belum Dibuat
            </h4>
            <p className="text-[10px] text-slate-400 max-w-xs mt-1 leading-relaxed">
              Klik tombol di atas untuk memerintahkan AI menganalisis ketetapan
              HET pangan harian dan memberikan 3 rekomendasi taktis.
            </p>
            <div className="mt-4 flex gap-2.5 flex-wrap justify-center text-[10px] text-blue-400 font-medium">
              <span className="px-2 py-0.5 bg-white/5 rounded border border-[#1f2937]">
                • Evaluasi Log Harga
              </span>
              <span className="px-2 py-0.5 bg-white/5 rounded border border-[#1f2937]">
                • Alur Logistik Tanjung Kalian
              </span>
              <span className="px-2 py-0.5 bg-white/5 rounded border border-[#1f2937]">
                • Formula Subsidy Operasi Pasar
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Guidelines footer */}
      <div className="px-4 py-3 md:px-5 bg-gray-950 border-t border-[#1f2937] text-[10px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          Rekomendasi bersifat saran akademis/teknis penunjang keputusan.
        </span>
        {/* <span className="font-mono text-blue-400 font-semibold uppercase tracking-wider">
          TPID Kab. Bangka Barat © 2026
        </span> */}
      </div>
      <div className="px-4 py-3 md:px-5 bg-gray-950 border-t border-[#1f2937] text-[10px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* <span className="flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          Rekomendasi bersifat saran akademis/teknis penunjang keputusan.
        </span> */}
        <span className="font-mono text-blue-400 font-semibold uppercase tracking-wider">
          TPID Kab. Bangka Barat © 2026
        </span>
      </div>
    </div>
  );
}
