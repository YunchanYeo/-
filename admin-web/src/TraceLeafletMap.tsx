import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

export type Point = { latitude: number; longitude: number };

export type TraceLeafletMapHandle = {
  /** 适配视图以显示整条轨迹 */
  fitAll: () => void;
  /** 跳转并突出最后一个（当前）轨迹点 */
  flyToCurrent: () => void;
  /** 跳转并突出单个坐标（如点击轨迹行） */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

const startIcon = new L.DivIcon({
  className: 'trace-marker trace-marker--start',
  html: '<div class="trace-marker__dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const endIcon = new L.DivIcon({
  className: 'trace-marker trace-marker--end',
  html: '<div class="trace-marker__dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const TraceLeafletMap = forwardRef<TraceLeafletMapHandle, { points: Point[] }>(function TraceLeafletMap({ points }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const pulseRef = useRef<L.CircleMarker | null>(null);

  const path = useMemo(() => points.map((p) => [p.latitude, p.longitude] as [number, number]), [points]);
  const start = points[0];
  const end = points[points.length - 1];

  function removePulse() {
    pulseRef.current?.remove();
    pulseRef.current = null;
  }

  useImperativeHandle(
    ref,
    () => ({
      fitAll() {
        const map = mapRef.current;
        if (!map) return;
        removePulse();
        const pts = pointsRef.current.map((p) => [p.latitude, p.longitude] as [number, number]);
        if (pts.length > 1) {
          map.fitBounds(L.latLngBounds(pts), { padding: [18, 18] });
        } else if (pts.length === 1) {
          map.setView(pts[0], 12);
        }
      },
      flyToCurrent() {
        const map = mapRef.current;
        const pts = pointsRef.current;
        const last = pts[pts.length - 1];
        if (!map || !last) return;
        const z = Math.max(map.getZoom(), 13);
        map.flyTo([last.latitude, last.longitude], z, { duration: 0.45 });
        setPulse(map, last.latitude, last.longitude);
      },
      flyTo(lat: number, lng: number, zoom = 14) {
        const map = mapRef.current;
        if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const z = Math.max(map.getZoom(), zoom);
        map.flyTo([lat, lng], z, { duration: 0.45 });
        setPulse(map, lat, lng);
      },
    }),
    [],
  );

  function setPulse(map: L.Map, lat: number, lng: number) {
    removePulse();
    const c = L.circleMarker([lat, lng], {
      radius: 14,
      color: '#07c160',
      weight: 2,
      fillColor: '#07c160',
      fillOpacity: 0.28,
    }).addTo(map);
    pulseRef.current = c;
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!mapRef.current) {
      mapRef.current = L.map(host, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    const layers: L.Layer[] = [];

    if (path.length > 1) {
      layers.push(L.polyline(path, { color: '#07c160', weight: 4, opacity: 0.9 }).addTo(map));
    }
    if (start) {
      layers.push(L.marker([start.latitude, start.longitude], { icon: startIcon }).addTo(map));
    }
    if (end) {
      layers.push(L.marker([end.latitude, end.longitude], { icon: endIcon }).addTo(map));
    }

    removePulse();

    if (path.length > 1) {
      map.fitBounds(L.latLngBounds(path), { padding: [18, 18] });
    } else if (end) {
      map.setView([end.latitude, end.longitude], 12);
    } else {
      map.setView([39.9, 116.39], 5);
    }

    return () => {
      layers.forEach((l) => l.remove());
    };
  }, [path, start, end]);

  useEffect(() => {
    return () => {
      removePulse();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={hostRef} style={{ width: '100%', height: 220, borderRadius: 10, overflow: 'hidden' }} />;
});

export default TraceLeafletMap;
