import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Market, Commodity } from '../types';

interface MapComponentProps {
  market: Market;
  commodities: Commodity[];
}

export default function MapComponent({ market, commodities }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Center map on Pasar Mentok
    const lat = market?.latitude || -2.0682;
    const lng = market?.longitude || 105.1634;

    // Initialize Leaflet Map if not initialized
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: true
      });

      // Add clean Map tiles (CartoDB Positron - light, modern, beautiful government look)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([lat, lng], 14);
    }

    // Clear previous markers
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    // Create a custom pulsed marker icon representation
    const alertCount = commodities.filter(c => c.isWarning).length;
    const markerColor = alertCount > 0 ? 'bg-red-500' : 'bg-emerald-600';
    const radarColor = alertCount > 0 ? 'bg-red-500/30' : 'bg-emerald-500/30';

    const customIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full ${radarColor} animate-ping"></div>
          <div class="relative w-6 h-6 rounded-full ${markerColor} border-2 border-white shadow-lg flex items-center justify-center text-white">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25g-7.5 11.25-7.5-11.25Z" />
            </svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Popup Content
    const alertListHtml = commodities
      .filter(c => c.isWarning)
      .slice(0, 3)
      .map(c => `<li class="text-red-600 font-semibold">• ${c.name} (Rp ${c.latest_price?.toLocaleString('id-ID')})</li>`)
      .join('');

    const popupContent = `
      <div class="p-2 min-w-[200px]">
        <h4 class="font-bold text-slate-900 border-b pb-1 mb-1.5 text-sm">${market?.name || 'Pasar Induk Mentok'}</h4>
        <p class="text-xs text-slate-500 mb-2 leading-relaxed">${market?.address || ''}</p>
        <div class="text-xs">
          <span class="font-medium">Status Komoditas:</span>
          ${alertCount > 0 
            ? `<div class="mt-1"><span class="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-bold">Siaga (${alertCount} HET Terlampaui)</span></div>
               <ul class="text-[11px] mt-1.5 list-none pl-0 space-y-0.5">${alertListHtml}</ul>`
            : '<div class="mt-1"><span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Semua Aman / Di bawah HET</span></div>'
          }
        </div>
      </div>
    `;

    // Add marker to map
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstance.current);
    marker.bindPopup(popupContent).openPopup();

    return () => {
      // In HMR or component unmount, avoid leaving orphan map resources
    };
  }, [market, commodities]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-200">
      <div ref={mapRef} className="w-full h-full min-h-[300px]" id="sipid-market-map" />
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur shadow-md rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-slate-700 z-[400] pointer-events-none border border-slate-200 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white inline-block"></span>
          <span>Aman (Di Bawah HET)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white inline-block animate-pulse"></span>
          <span>Siaga (Melampaui HET)</span>
        </div>
      </div>
    </div>
  );
}
