import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  RefreshCw, 
  Sparkles, 
  BarChart2, 
  Database,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { SummaryResponse, Commodity, PriceLog } from './types';
import MapComponent from './components/MapComponent';
import HistoryChart from './components/HistoryChart';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import AdminPortal from './components/AdminPortal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portal'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);

  // Dark Mode Toggle State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('sipid_dark_mode') === 'true';
  });

  // Track if dark mode changes
  useEffect(() => {
    localStorage.setItem('sipid_dark_mode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);

  // Price Alarm Alert Threshold State
  const [alertThresholds, setAlertThresholds] = useState<{ [commodityId: string]: number }>(() => {
    const saved = localStorage.getItem('sipid_alert_thresholds');
    return saved ? JSON.parse(saved) : {};
  });

  const handleSaveThreshold = (id: string, value: number) => {
    const updated = { ...alertThresholds, [id]: value };
    setAlertThresholds(updated);
    localStorage.setItem('sipid_alert_thresholds', JSON.stringify(updated));
  };

  // Export Weekly price list to styled PDF with official header and headings
  const handleExportWeeklyPDF = () => {
    if (!data) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Outer border
    doc.setDrawColor(20, 83, 45); // emerald base
    doc.setLineWidth(0.4);
    doc.rect(8, 8, 194, 281);

    // Official header lines
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text("PEMERINTAH KABUPATEN BANGKA BARAT", 105, 18, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text("DINAS KOPERASI, UMKM DAN PERINDUSTRIAN KABUPATEN BANGKA BARAT", 105, 23, { align: "center" });
    doc.text("Sekretariat Tim Pengendalian Inflasi Daerah (TPID) • Pasar Induk Mentok", 105, 27, { align: "center" });

    // Header division
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.3);
    doc.line(16, 31, 194, 31);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(29, 78, 216);
    doc.text("LAPORAN RINGKASAN HARGA MINGGUAN", 105, 40, { align: "center" });
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);
    doc.text(`Waktu Cetak: ${wibTimeStr || new Date().toLocaleString()}`, 16, 48);
    doc.text("Keperluan: Bahan Pembahasan Rapat Koordinasi Pengendalian Inflasi", 16, 52);

    // Table coordinates
    let y = 60;
    doc.setFillColor(243, 244, 246);
    doc.rect(16, y, 178, 7, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(31, 41, 55);
    doc.text("NAMA KOMODITAS", 19, y + 5);
    doc.text("KATEGORI", 64, y + 5);
    doc.text("SATUAN", 96, y + 5);
    doc.text("HET RESMI (Rp)", 126, y + 5, { align: "right" });
    doc.text("HARGA SAAT INI (Rp)", 161, y + 5, { align: "right" });
    doc.text("FLUKTUASI", 191, y + 5, { align: "right" });

    doc.setDrawColor(156, 163, 175);
    doc.line(16, y + 7, 194, y + 7);
    y += 7;

    doc.setFont("Helvetica", "normal");
    const list = data.commodities || [];
    
    list.forEach((item) => {
      if (y > 255) {
        doc.addPage();
        doc.setDrawColor(20, 83, 45);
        doc.setLineWidth(0.4);
        doc.rect(8, 8, 194, 281);
        y = 18;
      }

      // Check threshold highlight
      const customThreshold = alertThresholds[item.id] || item.het_price;
      const isBreached = item.latest_price > customThreshold;

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(item.name || "-", 19, y + 5);
      
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      doc.text(item.category || "-", 64, y + 5);
      doc.text(item.unit || "-", 96, y + 5);
      doc.text(item.het_price.toLocaleString('id-ID'), 126, y + 5, { align: "right" });
      
      if (isBreached) {
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(220, 38, 38); // Warning color
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(31, 41, 55);
      }
      doc.text((item.latest_price || 0).toLocaleString('id-ID'), 161, y + 5, { align: "right" });
      
      if (item.status === 'UP') {
        doc.setTextColor(220, 38, 38);
        doc.text(`Naik (+${item.percentChange}%)`, 191, y + 5, { align: "right" });
      } else if (item.status === 'DOWN') {
        doc.setTextColor(22, 163, 74);
        doc.text(`Turun (${item.percentChange}%)`, 191, y + 5, { align: "right" });
      } else {
        doc.setTextColor(107, 114, 128);
        doc.text("Stabil", 191, y + 5, { align: "right" });
      }

      doc.setDrawColor(243, 244, 246);
      doc.line(16, y + 7, 194, y + 7);
      y += 7;
    });

    // Write sign-off
    y += 12;
    if (y > 230) {
      doc.addPage();
      doc.setDrawColor(20, 83, 45);
      doc.setLineWidth(0.4);
      doc.rect(8, 8, 194, 281);
      y = 18;
    }

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(8);
    doc.text("Disetujui Oleh,", 152, y);
    doc.text("Kepala Dinas Koperasi, UMKM, dan Perindustrian", 152, y + 4.5, { align: "center" });
    doc.text("Kabupaten Bangka Barat", 152, y + 9, { align: "center" });

    doc.setFont("Helvetica", "normal");
    doc.text("Drs. H. Ridwan, M.Si", 152, y + 27, { align: "center" });
    doc.line(117, y + 28, 187, y + 28);
    doc.text("NIP. 19691205 199303 1 004", 152, y + 32, { align: "center" });

    doc.save(`Laporan_Mingguan_Pangan_Mentok_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  // Dashboard UI Filters
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSiagaHetOnly, setShowSiagaHetOnly] = useState(false);

  // Selected Commodity for Historical Detail
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null);
  const [selectedCommHistory, setSelectedCommHistory] = useState<PriceLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Real-time local Clock State
  const [wibTimeStr, setWibTimeStr] = useState('');

  // Fetch Summary prices
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/public/summary');
      if (resp.ok) {
        const summary: SummaryResponse = await resp.json();
        setData(summary);
        
        // Default selected commodity to the first one with warnings or general first
        if (summary.commodities.length > 0) {
          const warningItem = summary.commodities.find(c => c.isWarning);
          const firstItem = warningItem || summary.commodities[0];
          setSelectedCommodityId(firstItem.id);
        }
      }
    } catch (e) {
      console.error("Failed to load official prices summary", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch History for selected commodity
  const fetchCommodityHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const resp = await fetch(`/api/public/commodity/${id}/history`);
      if (resp.ok) {
        const historyObj = await resp.json();
        setSelectedCommHistory(historyObj.history || []);
      }
    } catch (e) {
      console.error("Failed to fetch price logs curves", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Initial loading
  useEffect(() => {
    fetchSummary();
  }, []);

  // Sync historical chart on selection change
  useEffect(() => {
    if (selectedCommodityId) {
      fetchCommodityHistory(selectedCommodityId);
    }
  }, [selectedCommodityId]);

  // Clock ticks (Western Indonesian Time - WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // WIB coordinate timezone shift is UTC+7
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wibOffset = 7;
      const wibDate = new Date(utc + 3600000 * wibOffset);

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const dayName = days[wibDate.getDay()];
      const day = wibDate.getDate();
      const monthName = months[wibDate.getMonth()];
      const year = wibDate.getFullYear();

      const pad = (num: number) => num.toString().padStart(2, '0');
      const hrs = pad(wibDate.getHours());
      const mins = pad(wibDate.getMinutes());
      const secs = pad(wibDate.getSeconds());

      setWibTimeStr(`${dayName}, ${day} ${monthName} ${year} - ${hrs}:${mins}:${secs} WIB`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Category tags
  const categories = ['Semua', 'Bahan Pokok', 'Hortikultura', 'Daging & Ayam', 'Minyak & Mentega'];

  // Match items based on keyword and category switch
  const filteredCommodities = data?.commodities.filter(item => {
    const matchesCategory = activeCategory === 'Semua' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHETFilter = !showSiagaHetOnly || (item.isWarning === true || item.latest_price > (alertThresholds[item.id] || item.het_price));
    return matchesCategory && matchesSearch && matchesHETFilter;
  }) || [];

  const selectedCommodityDetails = data?.commodities.find(c => c.id === selectedCommodityId);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-250 ${isDarkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#F3F4F6] text-[#1A1A1A]'} font-sans antialiased`}>
      
      {/* 🏛️ Official Government Top Header Banner */}
      <header className="bg-[#111827] text-[#9ca3af] border-b border-[#1f2937] shadow-sm">
        
        {/* Sleek Blue Accent Crown */}
        <div className="bg-blue-600 h-1 w-full"></div>

        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          
          {/* Logo and Typography */}
          <div className="flex items-center gap-4">
            
            {/* Elegant Vector representation of Government Crest Emblem of Bangka Barat */}
            <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center p-1 border border-gray-700 shrink-0">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-blue-500">
                {/* Round green golden outer frame */}
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="#065f46" />
                <circle cx="50" cy="50" r="41" stroke="#fbbf24" strokeWidth="1" fill="#047857" />
                
                {/* Hill representation */}
                <path d="M20 75 Q40 50 50 64 T80 75" fill="#fbbf24" className="opacity-80" />
                <path d="M25 75 Q45 55 55 60 T75 75" fill="#047857" />
                
                {/* Sea lines representing West Bangka oceans */}
                <line x1="30" y1="78" x2="70" y2="78" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                <line x1="35" y1="83" x2="65" y2="83" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                
                {/* Rice star */}
                <g transform="translate(48,22)">
                  <path d="M2 15 Q0 0 10 1 Q7 10 2 15 Z" fill="#fbbf24" />
                </g>
                <g transform="translate(42,22) scale(-1, 1)">
                  <path d="M2 15 Q0 0 10 1 Q7 10 2 15 Z" fill="#fbbf24" />
                </g>
                
                {/* Tower pin center */}
                <rect x="47" y="44" width="6" height="25" fill="#f8fafc" rx="1" />
                <circle cx="50" cy="40" r="5" fill="#dc2626" />
              </svg>
            </div>

            <div className="text-left">
              <span className="text-[10px] font-extrabold tracking-widest text-[#9ca3af] uppercase">
                Pemerintah Kabupaten Bangka Barat
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight mt-0.5">
                Sadar Inflasi <span className="text-blue-500">Bangka Barat</span>
              </h1>
              <p className="text-xs text-[#9ca3af] font-medium leading-relaxed uppercase">
                Sistem Informasi Pengendalian Inflasi Daerah • Titik Pantau Pasar Mentok
              </p>
            </div>

          </div>

          {/* Time & Server Status */}
          <div className="flex flex-col items-start md:items-end justify-center text-left md:text-right gap-1.5 shrink-0">
            <div className="flex items-center gap-2 text-xs bg-gray-800/80 px-3 py-1.5 rounded border border-gray-700">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-slate-100">{wibTimeStr || 'Memuat Waktu...'}</span>
            </div>
            
            <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold px-2.5 py-0.5 uppercase tracking-wider bg-green-500/10 border border-green-500/20 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Sistem Publik Terintegrasi
            </div>
          </div>

        </div>

        {/* Major Tab Switching Navigation bar */}
        <div className="border-t border-gray-800 bg-[#111827]">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <nav className="flex gap-2 py-2" aria-label="Portal Navigation">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Pemantauan Harga Publik</span>
              </button>

              <button
                onClick={() => setActiveTab('portal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase transition cursor-pointer ${
                  activeTab === 'portal'
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Portal Surveyor & Admin</span>
              </button>
            </nav>

            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle Button */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 text-[#9ca3af] hover:text-white hover:bg-gray-800 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition select-none"
                title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              >
                {isDarkMode ? (
                  <>
                    <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.46 5.05L5.75 4.343a1 1 0 10-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd"></path>
                    </svg>
                    <span className="hidden md:inline text-[11px] font-bold"></span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                    </svg>
                    <span className="hidden md:inline text-[11px] font-bold"></span>
                  </>
                )}
              </button>

              <button
                onClick={fetchSummary}
                disabled={loading}
                className="p-1.5 text-[#9ca3af] hover:text-white hover:bg-gray-800 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Perbarui Data Manual"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Perbarui</span>
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* 🌍 Core Application Wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 md:py-6">
        
        {loading && !data ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-sm font-semibold text-slate-700 mt-4">Memuat data ...</span>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">Sistem sedang meresolusi riwayat log harga harian Pasar Induk Mentok.</p>
          </div>
        ) : activeTab === 'portal' ? (
          
          /* =======================================
             🔐 WORKSPACE: SURVEYOR/ADMIN SECURE PORTAL
             ======================================= */
          <div className="max-w-7xl w-full mx-auto py-4">
            <AdminPortal 
              commodities={data?.commodities || []} 
              onDataChanged={fetchSummary} 
              isDarkMode={isDarkMode}
            />
          </div>

        ) : (

          /* =======================================
             📊 VIEW: PUBLIC INTERACTIVE DASHBOARD
             ======================================= */
          <div className="space-y-5">
            
            {/* KPI STATS OVERVIEW DECK */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded shadow-sm divide-y sm:divide-y-0 sm:divide-x overflow-hidden border transition-all duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 divide-slate-800' : 'bg-white border-gray-200 divide-gray-100'}`}>
              
              {/* Card 1: Monitored Commodities */}
              <div className="p-5 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Komoditas Dipantau</span>
                  <span className={`text-2xl font-bold font-mono mt-0.5 block ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    {data?.stats.totalProducts || 0}
                  </span>
                  <span className="text-[10px] text-blue-500 font-bold bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                    Update Berkala (kg/lt)
                  </span>
                </div>
                <div className={`p-2.5 rounded h-10 w-10 flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <Database className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Severe Alerts Above HET */}
              <div className="p-5 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Siaga Melampaui HET</span>
                  <span className={`text-2xl font-bold font-mono mt-0.5 block ${data?.stats.alertProductsCount && data.stats.alertProductsCount > 0 ? 'text-red-500' : (isDarkMode ? 'text-slate-100' : 'text-gray-900')}`}>
                    {data?.stats.alertProductsCount || 0}
                  </span>
                  {data?.stats.alertProductsCount && data.stats.alertProductsCount > 0 ? (
                    <span className="text-[10px] text-red-500 font-bold bg-red-500/15 border border-red-500/15 px-1.5 py-0.5 rounded animate-pulse mt-1.5 inline-block">
                      Butuh Intervensi TPID!
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/15 border border-emerald-500/15 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                      Semua Terkendali ✓
                    </span>
                  )}
                </div>
                <div className={`p-2.5 rounded border h-10 w-10 flex items-center justify-center shrink-0 ${
                  data?.stats.alertProductsCount && data.stats.alertProductsCount > 0 
                  ? 'bg-red-500/10 text-red-500 border-red-500/25 animate-pulse' 
                  : (isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500 border-gray-200')
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: Target Location Coordinate */}
              <div className="p-5 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Lokasi Patokan Harga</span>
                  <span className={`text-sm font-bold mt-1 block font-sans ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    {data?.market.name || 'Pasar Induk Mentok'}
                  </span>
                  <span className={`text-[10px] font-medium block mt-1 leading-tight flex items-center gap-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <MapPin className="w-3 h-3 text-red-500 inline-block" /> Tanjung, Mentok
                  </span>
                </div>
                <div className={`p-2.5 rounded h-10 w-10 flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <MapPin className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4: Last Log Date */}
              <div className="p-5 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Tanggal Pembaruan</span>
                  <span className={`text-sm font-bold mt-1 block leading-tight font-sans ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    {data?.stats.lastUpdated ? new Date(data.stats.lastUpdated).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
                  </span>
                  <span className="text-[9px] text-blue-500 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold mt-1.5 inline-block uppercase">
                    Pukul 09:00 WIB
                  </span>
                </div>
                <div className={`p-2.5 rounded h-10 w-10 flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <RefreshCw className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* TWO-COLUMN WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* LEFT COLUMN: Map & Interactive Prices (7 Columns) */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* Geolocation Map Widget */}
                <div className={`rounded border shadow-sm overflow-hidden p-4 space-y-3 transition-colors duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-905'}`}>
                  <div className={`flex items-center justify-between border-b pb-2 mb-1 ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-100' : 'text-[#1A1A1A]'}`}>Pemetaan Titik Pantau Pasar</h3>
                    </div>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      Coords: {data?.market.latitude.toFixed(4)}, {data?.market.longitude.toFixed(4)}
                    </span>
                  </div>
                  
                  {/* Map canvas */}
                  <div className="w-full h-[320px]">
                    <MapComponent 
                      market={data?.market!} 
                      commodities={data?.commodities!} 
                    />
                  </div>
                </div>

                {/* 🛒 MAIN INDEX: PRICES TABLE WITH FILTERS */}
                <div className={`rounded border shadow-sm overflow-hidden p-4 space-y-4 transition-colors duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-905'}`}>
                  
                  {/* Title & Warning filters */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-gray-101'}`}>
                    <div className="text-left">
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>Indeks Harga Bahan Pangan Harian</h3>
                      <p className="text-[11px] text-gray-500 font-medium">Satuan per Kilogram (Kg) atau per Liter sesuai regulasi pusat</p>
                    </div>

                    {/* HET Violations Smart Alert Switch toggle */}
                    <button
                      onClick={() => setShowSiagaHetOnly(!showSiagaHetOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition border shrink-0 cursor-pointer select-none ${
                        showSiagaHetOnly 
                        ? 'bg-red-500 border-red-650 text-white shadow-sm font-bold'
                        : isDarkMode
                          ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{showSiagaHetOnly ? '⛔ Menyorot SIAGA HET' : 'Saring Siaga HET'}</span>
                    </button>
                  </div>

                  {/* Free search & Category Tabs split */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Search className="w-4 h-4 shrink-0 text-gray-400" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari komoditas (misal Beras, Cabai...)"
                        className={`w-full pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                      />
                    </div>

                    {/* Category quick selectors */}
                    <div className="flex flex-wrap gap-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition border cursor-pointer select-none ${
                            activeCategory === cat
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                            : isDarkMode
                              ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                              : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unified Table view */}
                  <div className={`border rounded overflow-hidden shadow-sm transition-colors duration-200 ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                    <table className={`w-full text-left text-xs ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                      <thead className={`text-[11px] font-bold uppercase tracking-widest border-b transition-colors duration-200 ${isDarkMode ? 'bg-slate-900/60 text-slate-400 border-slate-800' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        <tr>
                          <th className="px-4 py-3 font-semibold">Komoditas / Kategori</th>
                          <th className="px-4 py-3 font-semibold text-right">HET Resmi</th>
                          <th className="px-4 py-3 font-semibold text-right">Harga Hari Ini</th>
                          <th className="px-4 py-3 font-semibold text-center">Fluktuasi</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y transition-colors duration-200 ${isDarkMode ? 'divide-slate-800 bg-[#111827]' : 'divide-gray-100 bg-white'}`}>
                        {filteredCommodities.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs font-medium">
                              Tidak ada komoditas ditemukan yang memenuhi filter.
                            </td>
                          </tr>
                        ) : (
                          filteredCommodities.map((item) => {
                            const isSelected = item.id === selectedCommodityId;
                            return (
                              <tr 
                                key={item.id}
                                onClick={() => setSelectedCommodityId(item.id)}
                                className={`group cursor-pointer transition ${
                                  isSelected 
                                  ? 'bg-blue-50 hover:bg-blue-50 border-l-4 border-blue-600' 
                                  : 'hover:bg-blue-50/40 border-l-4 border-transparent'
                                }`}
                              >
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-bold transition leading-tight ${isSelected ? 'text-blue-600 font-extrabold' : 'text-gray-900 group-hover:text-blue-600'}`}>
                                      {item.name}
                                    </span>
                                    {item.isWarning && (
                                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" title="Melampaui HET pemerintah!"></span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">{item.category} / {item.unit}</span>
                                </td>
                                
                                <td className="px-4 py-3.5 text-right font-medium text-gray-500 font-mono text-xs">
                                  Rp {item.het_price.toLocaleString('id-ID')}
                                </td>

                                <td className="px-4 py-3.5 text-right">
                                  <span className={`font-bold font-mono text-xs block ${item.isWarning ? 'text-red-600' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Rp {item.latest_price?.toLocaleString('id-ID')}
                                  </span>
                                  {item.isWarning && (
                                    <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 border border-red-100 rounded inline-block mt-0.5">
                                      +{item.hetViolationPercentage}% di atas HET Limit
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {item.status === 'UP' ? (
                                      <span className="text-red-600 font-bold flex items-center gap-0.5" title="Harga Naik dibanding Kemarin">
                                        <TrendingUp className="w-3.5 h-3.5 text-red-500" /> 
                                        <span className="font-mono text-[10px] font-bold">+{item.percentChange}%</span>
                                      </span>
                                    ) : item.status === 'DOWN' ? (
                                      <span className="text-green-600 font-bold flex items-center gap-0.5" title="Harga Turun dibanding Kemarin">
                                        <TrendingDown className="w-3.5 h-3.5 text-green-500" /> 
                                        <span className="font-mono text-[10px] font-bold">{item.percentChange}%</span>
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 font-medium flex items-center gap-0.5" title="Harga Stabil">
                                        <Minus className="w-3.5 h-3.5 text-gray-300" />
                                        <span className="font-mono text-[10px] font-bold">0.0%</span>
                                      </span>
                                    )}
                                  </div>
                                </td>

                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-[10px] text-gray-400 leading-normal flex items-start gap-1.5 pt-1">
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      Klik salah satu baris produk komoditi pangan di atas untuk meneliti sebaran grafik riwayat harga dan analisis fluktuasi secara visual pada panel kanan.
                    </span>
                  </div>

                </div>

              </div>

              {/* RIGHT COLUMN: History Chart & AI Recommendation panel (5 Columns) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* 📋 Laporan Mingguan Export PDF Button Card */}
                <div className={`p-5 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 text-slate-100 shadow-2xl' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Laporan Mingguan TPID</h4>
                    </div>
                    <p className={`text-[11px] leading-relaxed max-w-xs ${isDarkMode ? 'text-slate-450' : 'text-slate-900'}`}>
                      Unduh ringkasan pergerakan harga bahan pokok minggu ini untuk keperluan rapat koordinasi.
                    </p>
                  </div>
                  <button
                    onClick={handleExportWeeklyPDF}
                    className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer shadow-sm select-none shrink-0"
                    id="export-pdf-weekly-btn"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Unduh PDF</span>
                  </button>
                </div>

                {/* Visual Chart Card */}
                {selectedCommodityId && selectedCommodityDetails ? (
                  <div className="space-y-4">
                    {historyLoading ? (
                      <div className={`p-12 rounded border flex flex-col items-center justify-center text-center h-[340px] transition-colors ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-gray-200'}`}>
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-gray-400 mt-4 leading-relaxed">Menyusun riwayat pergerakan harga komoditas...</span>
                      </div>
                    ) : (
                      <>
                        <HistoryChart 
                          commodity={selectedCommodityDetails} 
                          historyLogs={selectedCommHistory} 
                          customThreshold={alertThresholds[selectedCommodityId]}
                          isDarkMode={isDarkMode}
                        />

                        {/* Interactive Threshold Alarm Settings Tool */}
                        <div className={`p-4 rounded border transition-all duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-gray-905 shadow-sm'}`}>
                          <div className={`flex items-center gap-2 mb-2 border-b border-dashed pb-2 ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                            <span className="p-1 bg-amber-500/10 text-amber-500 rounded">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </span>
                            <h5 className="text-[10px] font-extrabold uppercase tracking-wider">Konfigurasi Alarm Ambang Batas Alert</h5>
                          </div>
                          
                          <p className={`text-[10px] leading-relaxed mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Tetapkan ambang batas alarm personal Anda untuk <strong className="font-bold">{selectedCommodityDetails.name}</strong>. Jika harga harian melebihi nilai ambang ini, alarm siaga visual merah akan menyala.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1 font-semibold text-slate-450">
                                <span>HET: Rp {selectedCommodityDetails.het_price.toLocaleString('id-ID')}</span>
                                <span>Alert: Rp {(alertThresholds[selectedCommodityId] || selectedCommodityDetails.het_price).toLocaleString('id-ID')}</span>
                              </div>
                              <input 
                                type="range"
                                min={Math.round(selectedCommodityDetails.het_price * 0.5)}
                                max={Math.round(selectedCommodityDetails.het_price * 1.8)}
                                step={100}
                                value={alertThresholds[selectedCommodityId] || selectedCommodityDetails.het_price}
                                onChange={(e) => handleSaveThreshold(selectedCommodityId, Number(e.target.value))}
                                className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'}`}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 self-end">
                              <input 
                                type="number"
                                value={alertThresholds[selectedCommodityId] || selectedCommodityDetails.het_price}
                                onChange={(e) => handleSaveThreshold(selectedCommodityId, Number(e.target.value))}
                                className={`w-24 text-center font-bold px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-gray-200 text-slate-800'}`}
                              />
                              <button
                                onClick={() => {
                                  const updated = { ...alertThresholds };
                                  delete updated[selectedCommodityId];
                                  setAlertThresholds(updated);
                                  localStorage.setItem('sipid_alert_thresholds', JSON.stringify(updated));
                                }}
                                className={`px-2 py-1 text-[9px] font-bold text-[#9ca3af] hover:text-red-500 hover:bg-red-500/15 rounded border cursor-pointer transition uppercase ${isDarkMode ? 'border-slate-800' : 'border-gray-300'}`}
                                title="Reset ke HET Resmi"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={`p-8 rounded border text-center py-16 text-gray-400 flex flex-col items-center justify-center shadow-sm transition-colors ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-gray-200'}`}>
                    <BarChart2 className="w-12 h-12 stroke-[1] text-gray-300 mb-2.5" />
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest leading-normal">Grafik Harga Historis</h4>
                    <p className="text-[10px] text-gray-400 mt-1 max-w-xs leading-relaxed">
                      Klik salah satu komoditas bahan pangan harian di sisi kiri untuk memvisualisasikan grafik tren harga secara interaktif.
                    </p>
                  </div>
                )}

                {/* Gemini AI smart analyst */}
                <AIAnalysisPanel />

              </div>

            </div>

          </div>
        )}

      </main>

      {/* 🇮🇩 Elegant Footer Panel */}
      <footer className="h-20 border-t border-gray-200 bg-gray-50 px-6 flex items-center justify-between shrink-0 text-xs">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          
          <div className="space-y-0.5">
            <div className="flex items-center justify-center md:justify-start gap-2 text-gray-900 font-bold">
              <span>DINAS KOPERASI, UMKM DAN PERINDUSTRIAN KABUPATEN BANGKA BARAT</span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono font-medium max-w-xl leading-relaxed">
              TPID Kab. Bangka Barat • API v4.2.1-stable • VPS Mandiri Pemerintah Daerah Bangka Barat
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-1 font-mono text-[10px] text-gray-400">
            <span className="uppercase font-bold text-gray-500 tracking-wider">Sadar Inflasi Bangka Barat Versi 2.0</span>
            <span>
              Hak Cipta Dilindungi © 2026
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}
