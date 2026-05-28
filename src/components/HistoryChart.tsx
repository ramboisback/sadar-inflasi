import { useId } from 'react';
import { Commodity, PriceLog } from '../types';

interface HistoryChartProps {
  commodity: Commodity;
  historyLogs: PriceLog[];
  customThreshold?: number;
  isDarkMode?: boolean;
}

export default function HistoryChart({ commodity, historyLogs, customThreshold, isDarkMode }: HistoryChartProps) {
  const gradientId = useId();
  if (!historyLogs || historyLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <svg className="w-12 h-12 mb-2 stroke-current opacity-60" fill="none" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.008 1.24l.885 1.77a2.25 2.25 0 0 0 2.007 1.24h1.98a2.25 2.25 0 0 0 2.007-1.24l.885-1.77a2.25 2.25 0 0 1 2.007-1.24h3.86m-18 0h18" />
        </svg>
        <span className="text-xs font-medium">Belum ada data riwayat harga harian.</span>
      </div>
    );
  }

  // Dimensions
  const width = 600;
  const height = 280;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Prices
  const prices = historyLogs.map(log => log.recorded_price);
  const minPriceVal = Math.min(...prices, commodity.het_price);
  const maxPriceVal = Math.max(...prices, commodity.het_price);
  
  // Give some vertical head/floor margins
  const priceMargin = (maxPriceVal - minPriceVal) * 0.15 || 2000;
  const minPrice = Math.max(0, minPriceVal - priceMargin);
  const maxPrice = maxPriceVal + priceMargin;

  const priceRange = maxPrice - minPrice;

  // X points
  const pointsCount = historyLogs.length;
  const xPoints = historyLogs.map((_, i) => {
    if (pointsCount <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (i / (pointsCount - 1)) * chartWidth;
  });

  // Y points helper
  const getY = (price: number) => {
    if (priceRange === 0) return paddingTop + chartHeight / 2;
    return paddingTop + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  const yPoints = prices.map(price => getY(price));

  // Generate SVG path coordinate strings
  let linePath = "";
  let areaPath = "";

  if (pointsCount > 0) {
    linePath = `M ${xPoints[0]} ${yPoints[0]} ` + xPoints.slice(1).map((x, i) => `L ${x} ${yPoints[i + 1]}`).join(" ");
    areaPath = `${linePath} L ${xPoints[pointsCount - 1]} ${paddingTop + chartHeight} L ${xPoints[0]} ${paddingTop + chartHeight} Z`;
  }

  // Calculate HET Y location
  const hetY = getY(commodity.het_price);

  // Calculate custom threshold Y location if provided
  const hasThreshold = customThreshold !== undefined;
  const thresholdY = hasThreshold ? getY(customThreshold) : 0;

  // Stats
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const totalChange = lastPrice - firstPrice;
  const changePercentage = ((lastPrice - firstPrice) / (firstPrice || 1)) * 100;

  // Grid lines
  const gridLinesCount = 4;
  const gridLinePrices = Array.from({ length: gridLinesCount }, (_, i) => {
    return minPrice + (i / (gridLinesCount - 1)) * priceRange;
  });

  const getDayLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`; // DD/MM format
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Select a few dates to show on X-axis (e.g., 4 points: start, 1/3, 2/3, end)
  const xAxisIndices = [0, Math.floor(pointsCount / 3), Math.floor(2 * pointsCount / 3), pointsCount - 1].filter(
    (val, index, self) => self.indexOf(val) === index && val < pointsCount
  );

  return (
    <div className={`p-4 rounded border shadow-sm transition-all duration-200 ${isDarkMode ? 'bg-[#111827] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-gray-900'}`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-gray-101'}`}>
        <div>
          <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
            Tren Harga 30 Hari Terakhir
          </span>
          <h4 className="text-base font-bold mt-1 flex items-center gap-1.5">
            {commodity.name}
            <span className="text-xs font-normal text-slate-400">/ per {commodity.unit}</span>
          </h4>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-slate-400 text-[10px] uppercase block font-medium">Harga Terkini</span>
            <span className="font-bold text-sm">
              Rp {lastPrice?.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-400 text-[10px] uppercase block font-medium">Fluktuasi Sebulan</span>
            <span className={`font-bold flex items-center justify-end gap-0.5 text-sm ${totalChange > 0 ? 'text-red-550' : totalChange < 0 ? 'text-emerald-500' : 'text-slate-450'}`}>
              {totalChange > 0 ? '▲' : totalChange < 0 ? '▼' : '▬'} 
              {Math.abs(changePercentage).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Chart */}
      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={totalChange >= 0 ? "#ef4444" : "#10b981"} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={totalChange >= 0 ? "#ef4444" : "#10b981"} stopOpacity="0.00"/>
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis labels */}
          {gridLinePrices.map((p, i) => {
            const y = getY(p);
            return (
              <g key={i} className="opacity-40">
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="#94a3b8" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="fill-slate-400 font-mono text-[10px] font-medium"
                >
                  Rp {Math.round(p / 100) * 100 >= 1000 ? `${(Math.round(p / 100) * 100 / 1000).toFixed(1)}k` : Math.round(p)}
                </text>
              </g>
            );
          })}

          {/* Area under the price curve */}
          {areaPath && (
            <path 
              d={areaPath} 
              fill={`url(#${gradientId})`} 
            />
          )}

          {/* Horizontal HET Line (Dashed Red Line) */}
          <line 
            x1={paddingLeft} 
            y1={hetY} 
            x2={width - paddingRight} 
            y2={hetY} 
            stroke="#ef4444" 
            strokeWidth="1.8" 
            strokeDasharray="6 3" 
            id={`het-limit-line-${commodity.id}`}
          />

          {/* HET label background marker */}
          <g transform={`translate(${width - paddingRight - 85}, ${hetY - 18})`}>
            <rect 
              width="80" 
              height="14" 
              rx="3" 
              fill="#ef4444" 
              className="opacity-95" 
            />
            <text 
              x="30" 
              y="10" 
              textAnchor="middle" 
              className="fill-white font-sans text-[8px] font-extrabold uppercase tracking-wider"
            >
              HET: Rp {commodity.het_price.toLocaleString('id-ID')}
            </text>
          </g>

          {/* Horizontal Custom Alert Threshold Line (Dashed Orange Line) */}
          {hasThreshold && (
            <>
              <line 
                x1={paddingLeft} 
                y1={thresholdY} 
                x2={width - paddingRight} 
                y2={thresholdY} 
                stroke="#d97706" 
                strokeWidth="1.8" 
                strokeDasharray="4 4" 
                id={`custom-threshold-alert-line-${commodity.id}`}
              />

              {/* Threshold label background marker */}
              <g transform={`translate(${paddingLeft + 15}, ${thresholdY - 18})`}>
                <rect 
                  width="110" 
                  height="14" 
                  rx="3" 
                  fill="#d97706" 
                  className="opacity-95" 
                />
                <text 
                  x="55" 
                  y="10" 
                  textAnchor="middle" 
                  className="fill-white font-sans text-[8px] font-bold uppercase tracking-wider"
                >
                  Alert Anda: Rp {customThreshold?.toLocaleString('id-ID')}
                </text>
              </g>
            </>
          )}

          {/* Main Price Curve Line */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke={totalChange >= 0 ? "#de2910" : "#0ca36e"} 
              strokeWidth="2.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots on coordinate points */}
          {xPoints.map((x, i) => {
            const isLatest = i === pointsCount - 1;
            const price = prices[i];
            const isAboveHET = price > commodity.het_price;

            // Only draw dots for first, last, or if it crosses HET/anomalies for cleanliness
            if (!isLatest && i !== 0 && i % 3 !== 0) return null;

            return (
              <g key={i}>
                <circle 
                  cx={x} 
                  cy={yPoints[i]} 
                  r={isLatest ? "5.5" : "3.5"} 
                  fill={isAboveHET ? "#dc2626" : (totalChange >= 0 ? "#ef4444" : "#10b981")} 
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="shadow-sm"
                />
                
                {/* Pop the latest point cost value */}
                {isLatest && (
                  <g transform={`translate(${x - 30}, ${yPoints[i] - 25})`}>
                    <rect 
                      width="60" 
                      height="18" 
                      rx="4" 
                      fill="#1e293b" 
                    />
                    <text 
                      x="30" 
                      y="12" 
                      textAnchor="middle" 
                      className="fill-white font-sans text-[9px] font-bold"
                    >
                      Rp {price.toLocaleString('id-ID')}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* X Axis baseline */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop + chartHeight} 
            x2={width - paddingRight} 
            y2={paddingTop + chartHeight} 
            stroke="#cbd5e1" 
            strokeWidth="1.5" 
          />

          {/* X Axis Date labels */}
          {xAxisIndices.map((index) => {
            const x = xPoints[index];
            const dateStr = historyLogs[index].recorded_at;
            return (
              <text 
                key={index}
                x={x} 
                y={paddingTop + chartHeight + 16} 
                textAnchor="middle" 
                className="fill-slate-400 font-mono text-[10px] font-semibold"
              >
                {getDayLabel(dateStr)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-red-500 border-t border-dashed border-red-500 inline-block"></span>
          <span>Harga Eceran Tertinggi (HET) Pemerintah Daerah</span>
        </div>
        <div className="text-[10px] font-mono">
          Periode: {historyLogs[0]?.recorded_at} s/d {historyLogs[historyLogs.length - 1]?.recorded_at} (WIB)
        </div>
      </div>
    </div>
  );
}
