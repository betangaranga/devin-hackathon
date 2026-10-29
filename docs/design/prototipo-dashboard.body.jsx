<div id="root"></div>
<script type="text/jsx">
const DIMS = [
  { key: "agua", name: "Abasto de agua", unit: "reportes de falta de agua por 1,000 hab. (12 meses)",
    why: "Las colonias con tandeo o fugas frecuentes pasan días sin agua en temporada seca (mar–may).",
    ask: ["¿Tiene cisterna y tinaco? ¿De qué capacidad?", "¿Cuántos días a la semana llega el agua?", "¿Hay sistema de captación de lluvia (SCALL)?"],
    source: "SACMEX · Reportes de agua, Consumo de agua por colonia", grain: "Colonia · mensual" },
  { key: "inundacion", name: "Inundación", unit: "nivel del Atlas de Riesgo por precipitación",
    why: "Afecta sobre todo plantas bajas, estacionamientos y la movilidad en lluvias (jun–sep).",
    ask: ["¿El departamento es planta baja o tiene sótano?", "¿Se ha metido el agua alguna vez?", "¿La calle se encharca en temporada de lluvias?"],
    source: "SGIRPC · Atlas de Riesgo (precipitación)", grain: "Polígono de peligro" },
  { key: "sismo", name: "Sismo y reconstrucción", unit: "inmuebles en reconstrucción a < 500 m",
    why: "Edificios cercanos dañados en 2017 indican suelo o construcciones vulnerables en la zona.",
    ask: ["¿El edificio tiene dictamen estructural posterior a 2017?", "¿Año de construcción?", "¿Tiene Director Responsable de Obra registrado?"],
    source: "Comisión para la Reconstrucción · Inmuebles en atención; Padrón de DRO", grain: "Punto (inmueble)" },
  { key: "vial", name: "Seguridad vial", unit: "incidentes viales a < 500 m (12 meses)",
    why: "Importa si caminas con niños, usas bici o cruzas avenidas a diario.",
    ask: ["¿Hay cruces seguros cerca de la escuela o el transporte?"],
    source: "C5 · Incidentes viales; SSC · Hechos de tránsito", grain: "Punto · fecha y hora" },
  { key: "ruido", name: "Ruido", unit: "dB estimados (día / noche)",
    why: "Avenidas, bares y obras cambian mucho la calidad de sueño y el trabajo desde casa.",
    ask: ["¿Las recámaras dan a la calle o al interior?", "¿Ventanas con doble vidrio?"],
    source: "SEDEMA · Contaminación acústica", grain: "Polígono / corredor" },
  { key: "calor", name: "Calor", unit: "temperatura media anual de la zona",
    why: "Zonas más calientes y con poco arbolado elevan la temperatura interior en primavera.",
    ask: ["¿Último piso o con azotea expuesta?", "¿Tiene ventilación cruzada?"],
    source: "SEDEMA · Zonas de temperatura media anual", grain: "Polígono" },
  { key: "granizo", name: "Granizo", unit: "nivel del Atlas de Riesgo por granizo",
    why: "Puede dañar autos estacionados en la calle, domos y tragaluces.",
    ask: ["¿El estacionamiento es techado?"],
    source: "SGIRPC · Atlas de Riesgo (granizo)", grain: "Polígono de peligro" },
  { key: "servicios", name: "Servicios a pie", unit: "minutos caminando a servicios básicos",
    why: "Tener salud, escuela, mercado y transporte a 15 minutos ahorra tiempo y dinero cada día.",
    ask: [],
    source: "Centros de salud, Escuelas públicas, Mercados públicos y sobre ruedas, Metro/Metrobús, Ecobici, WiFi CDMX", grain: "Punto" },
];

const PATRIMONIO_META = { source: "SEDUVI · Áreas de conservación patrimonial, Inmuebles catalogados" };

const ADDRESSES = [
  {
    id: "a", label: "Calle Ejemplo 120, Col. Las Arboledas", alcaldia: "Alcaldía Norte (ejemplo)",
    scores: { agua: 78, inundacion: 35, sismo: 30, vial: 41, ruido: 38, calor: 62, granizo: 55, servicios: 91 },
    values: { agua: "2.1 reportes / 1,000 hab.", inundacion: "Peligro medio-alto", sismo: "6 inmuebles", vial: "84 incidentes", ruido: "71 dB / 63 dB", calor: "17.9 °C", granizo: "Peligro medio", servicios: "Todo a < 12 min" },
    patrimonio: { inZone: true, text: "Dentro de un área de conservación patrimonial: remodelaciones de fachada requieren permiso de SEDUVI." },
    services: [
      { kind: "Centro de salud", min: 6, x: 360, y: 150 }, { kind: "Escuela primaria pública", min: 4, x: 250, y: 140 },
      { kind: "Mercado público", min: 9, x: 200, y: 260 }, { kind: "Metro / Metrobús", min: 7, x: 420, y: 250 },
      { kind: "Cicloestación Ecobici", min: 3, x: 330, y: 230 }, { kind: "WiFi gratuito", min: 2, x: 280, y: 180 },
    ],
    incidents: [6, 7, 5, 8, 9, 7, 6, 8, 7, 6, 8, 7],
    water: [0.1, 0.1, 0.3, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2],
    hotspots: [{ name: "Av. Principal y Eje 5", n: 23 }, { name: "Av. Principal y Calle 9", n: 11 }, { name: "Eje 5 y Calle Roble", n: 7 }],
    flood: true,
  },
  {
    id: "b", label: "Calle Ficticia 45, Col. Los Pinos", alcaldia: "Alcaldía Centro (ejemplo)",
    scores: { agua: 64, inundacion: 80, sismo: 68, vial: 22, ruido: 18, calor: 40, granizo: 70, servicios: 84 },
    values: { agua: "3.4 reportes / 1,000 hab.", inundacion: "Peligro bajo", sismo: "1 inmueble", vial: "131 incidentes", ruido: "76 dB / 69 dB", calor: "18.6 °C", granizo: "Peligro bajo", servicios: "Casi todo a < 15 min" },
    patrimonio: { inZone: false, text: "Fuera de áreas de conservación patrimonial; 2 inmuebles catalogados a menos de 300 m." },
    services: [
      { kind: "Centro de salud", min: 11, x: 450, y: 120 }, { kind: "Escuela primaria pública", min: 8, x: 210, y: 150 },
      { kind: "Mercado público", min: 5, x: 340, y: 270 }, { kind: "Metro / Metrobús", min: 4, x: 420, y: 250 },
      { kind: "Cicloestación Ecobici", min: 5, x: 380, y: 200 }, { kind: "WiFi gratuito", min: 1, x: 310, y: 190 },
    ],
    incidents: [10, 12, 9, 11, 13, 12, 10, 11, 12, 10, 11, 10],
    water: [0.2, 0.2, 0.4, 0.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2],
    hotspots: [{ name: "Eje Central y Av. Juárez (ej.)", n: 38 }, { name: "Eje Central y Calle 3", n: 19 }, { name: "Calle 3 y Calle 7", n: 9 }],
    flood: false,
  },
  {
    id: "c", label: "Calle Modelo 8, Col. Valle Verde", alcaldia: "Alcaldía Oriente (ejemplo)",
    scores: { agua: 12, inundacion: 20, sismo: 45, vial: 66, ruido: 74, calor: 28, granizo: 40, servicios: 46 },
    values: { agua: "14.8 reportes / 1,000 hab.", inundacion: "Peligro alto", sismo: "3 inmuebles", vial: "39 incidentes", ruido: "62 dB / 52 dB", calor: "19.4 °C", granizo: "Peligro medio-alto", servicios: "Metro a 22 min" },
    patrimonio: { inZone: false, text: "Fuera de áreas de conservación patrimonial." },
    services: [
      { kind: "Centro de salud", min: 14, x: 470, y: 300 }, { kind: "Escuela primaria pública", min: 6, x: 240, y: 230 },
      { kind: "Mercado sobre ruedas (mar y sáb)", min: 8, x: 190, y: 160 }, { kind: "Metro / Metrobús", min: 22, x: 560, y: 250 },
      { kind: "Cicloestación Ecobici", min: null, x: null, y: null }, { kind: "WiFi gratuito", min: 4, x: 330, y: 140 },
    ],
    incidents: [3, 4, 3, 2, 4, 3, 4, 3, 4, 3, 3, 3],
    water: [0.6, 0.8, 1.6, 2.4, 2.6, 1.9, 0.9, 0.7, 0.8, 0.9, 0.8, 0.8],
    hotspots: [{ name: "Av. Oriente y Calle 12", n: 9 }, { name: "Av. Oriente y Calle 20", n: 6 }, { name: "Calle 12 y Calle Sur", n: 3 }],
    flood: true,
  },
];

const PROFILES = {
  equilibrado: { label: "Equilibrado", w: {} },
  familia: { label: "Familia con niños", w: { servicios: 2, vial: 2, agua: 1.5 } },
  homeoffice: { label: "Trabajo en casa", w: { ruido: 2.5, agua: 1.5, calor: 1.5 } },
  mayor: { label: "Adulto mayor", w: { servicios: 2, calor: 2, sismo: 1.5, vial: 1.5 } },
  sinauto: { label: "Sin auto", w: { servicios: 2.5, vial: 1.5, granizo: 0.3 } },
};

const MONTHS = ["Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov"];
const CITY_WATER = [0.3, 0.3, 0.5, 0.8, 0.9, 0.7, 0.4, 0.3, 0.3, 0.4, 0.3, 0.3];
const CITY_INCIDENTS = 6;

const level = (s) => s >= 67 ? { label: "Bien", variant: "success", color: "rgb(var(--text-green))", text: "text-green" }
  : s >= 34 ? { label: "Regular", variant: "orange", color: "rgb(var(--text-orange))", text: "text-orange" }
  : { label: "Atención", variant: "destructive", color: "rgb(var(--text-red))", text: "text-red" };

function profileScore(addr, profile) {
  const w = PROFILES[profile].w;
  let num = 0, den = 0;
  DIMS.forEach((d) => { const wt = w[d.key] ?? 1; num += addr.scores[d.key] * wt; den += wt; });
  return Math.round(num / den);
}

function verdict(addr) {
  const sorted = DIMS.slice().sort((x, y) => addr.scores[x.key] - addr.scores[y.key]);
  const worst = sorted.slice(0, 2).filter((d) => addr.scores[d.key] < 50).map((d) => d.name.toLowerCase());
  const best = sorted.slice(-2).reverse().filter((d) => addr.scores[d.key] >= 67).map((d) => d.name.toLowerCase());
  return { best, worst };
}


const ICONS = {
  agua: <path d="M12 3c3.5 4.5 6 7.6 6 10.5A6 6 0 0 1 6 13.5C6 10.6 8.5 7.5 12 3z" />,
  inundacion: <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />,
  sismo: <path d="M5 21V6l7-3 7 3v15M3 21h18M12 3v5l-2 3 3 3-2 3 1 4" />,
  vial: <path d="M4 16h16v-3l-2-5H6l-2 5v3zM4 13h16M7 19.5a1.5 1.5 0 1 0 0-3M17 19.5a1.5 1.5 0 1 0 0-3M7 16.5v3M17 16.5v3" />,
  ruido: <path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
  calor: <g><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g>,
  granizo: <g><path d="M7 14a4 4 0 0 1 .5-8A5 5 0 0 1 17 7a3.5 3.5 0 0 1 0 7H7z" /><circle cx="8" cy="18" r="1" /><circle cx="12" cy="20.5" r="1" /><circle cx="16" cy="18" r="1" /></g>,
  servicios: <g><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></g>,
  patrimonio: <path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />,
  salud: <path d="M12 5v14M5 12h14" />,
  escuela: <path d="M3 9l9-4 9 4-9 4-9-4zM7 11v4c3 2 7 2 10 0v-4" />,
  mercado: <path d="M5 9h14l-1.5 9h-11L5 9zM9 9l3-5 3 5" />,
  transporte: <path d="M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 11h14M9 21l1-4M15 21l-1-4" />,
  bici: <g><circle cx="6" cy="16" r="3" /><circle cx="18" cy="16" r="3" /><path d="M6 16l4-7h5l3 7M10 9l2 7h-6" /></g>,
  wifi: <g><path d="M4 9a12 12 0 0 1 16 0M7 12.5a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0" /><circle cx="12" cy="19" r="0.8" /></g>,
};
const SERVICE_ICON = (kind) => kind.startsWith("Centro") ? "salud" : kind.startsWith("Escuela") ? "escuela" : kind.startsWith("Mercado") ? "mercado" : kind.startsWith("Metro") ? "transporte" : kind.startsWith("Ciclo") ? "bici" : "wifi";

function Icon({ name, size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{ICONS[name]}</svg>
  );
}

const SHORT = { agua: "Agua", inundacion: "Inundación", sismo: "Sismo", vial: "Seg. vial", ruido: "Ruido", calor: "Calor", granizo: "Granizo", servicios: "Servicios" };

function polar(c, r, deg) { const a = (deg - 90) * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; }
function wedge(c, r0, r1, a1, a2) {
  const large = a2 - a1 > 180 ? 1 : 0;
  const [x1, y1] = polar(c, r0, a1), [x2, y2] = polar(c, r1, a1), [x3, y3] = polar(c, r1, a2), [x4, y4] = polar(c, r0, a2);
  return `M${x1},${y1} L${x2},${y2} A${r1},${r1} 0 ${large} 1 ${x3},${y3} L${x4},${y4} A${r0},${r0} 0 ${large} 0 ${x1},${y1} Z`;
}
function spans(profile) {
  const w = PROFILES[profile].w;
  const ws = DIMS.map((d) => w[d.key] ?? 1);
  const tot = ws.reduce((a, b) => a + b, 0);
  let a = 0;
  return DIMS.map((d, i) => { const span = 360 * ws[i] / tot; const s = { key: d.key, a1: a, a2: a + span, mid: a + span / 2 }; a += span; return s; });
}

function Flower({ addr, profile, size = 340, selected, onSelect, icons = true }) {
  const c = size / 2, r0 = size * 0.15, R = size * (icons ? 0.37 : 0.47);
  const sp = spans(profile);
  const score = profileScore(addr, profile);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {sp.map((p) => {
          const s = addr.scores[p.key];
          const sel = selected === p.key;
          return (
            <g key={p.key} onClick={onSelect ? () => onSelect(p.key) : undefined} style={{ cursor: onSelect ? "pointer" : "default" }}>
              <path d={wedge(c, r0, R, p.a1 + 1.2, p.a2 - 1.2)} fill="currentColor" className="text-tertiary" fillOpacity="0.1" />
              <path d={wedge(c, r0, r0 + (R - r0) * Math.max(s, 6) / 100, p.a1 + 1.2, p.a2 - 1.2)} fill={level(s).color} fillOpacity={sel ? 1 : 0.75} stroke={sel ? "currentColor" : "none"} strokeWidth="2" className="text-primary" />
            </g>
          );
        })}
        <circle cx={c} cy={c} r={R} fill="none" stroke="currentColor" className="text-tertiary" strokeOpacity="0.25" strokeDasharray="2 4" />
        <text x={c} y={c + size * 0.035} textAnchor="middle" fontSize={size * 0.12} fontWeight="600" fill={level(score).color}>{score}</text>
      </svg>
      {icons && sp.map((p) => {
        const [x, y] = polar(c, R + 24, p.mid);
        const s = addr.scores[p.key];
        return (
          <div key={p.key} className="absolute" style={{ left: x - 16, top: y - 16 }}>
            <Tooltip content={`${SHORT[p.key]} · ${level(s).label}`}>
              <IconButton size="md" shape="circle" variant={selected === p.key ? "secondary" : "ghost"} aria-label={SHORT[p.key]} onClick={() => onSelect && onSelect(p.key)}>
                <span className={level(s).text}><Icon name={p.key} size={18} /></span>
              </IconButton>
            </Tooltip>
            <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${y < c ? "top-[-14px]" : "top-[32px]"}`}><Text size={10} className="text-tertiary">{SHORT[p.key]}</Text></div>
          </div>
        );
      })}
    </div>
  );
}


function rng(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const SCALE4 = ["Bajo", "Medio", "Medio-alto", "Alto"];
const scaleIdx = (txt) => txt.includes("alto") && txt.includes("medio") ? 2 : txt.includes("alto") ? 3 : txt.includes("medio") ? 1 : 0;
const maxWalk = (a) => Math.max(...a.services.filter((s) => s.min != null).map((s) => s.min));
const PROFILE_SHORT = { equilibrado: "Equilibrado", familia: "Familia", homeoffice: "Home office", mayor: "Adulto mayor", sinauto: "Sin auto" };

function card(addr, k) {
  const v = addr.values[k];
  if (k === "agua") return { big: v.split(" ")[0], unit: "reportes / 1k hab." };
  if (k === "inundacion" || k === "granizo") return { big: `${scaleIdx(v.toLowerCase()) + 1}/4`, unit: "nivel de peligro" };
  if (k === "sismo") return { big: `${parseInt(v, 10)}`, unit: "edif. dañados" };
  if (k === "vial") return { big: `${parseInt(v, 10)}`, unit: "incidentes / año" };
  if (k === "ruido") return { big: v.split(" ")[0], unit: "dB de día" };
  if (k === "calor") return { big: `${parseFloat(v)}°`, unit: "media anual" };
  return { big: `${maxWalk(addr)}′`, unit: "máx. a pie" };
}

function callout(addr, k) {
  const pct = { v: `${addr.scores[k]}%`, l: "colonias por debajo" };
  if (k === "agua") {
    const i = addr.water.indexOf(Math.max(...addr.water));
    const ratio = addr.water.reduce((a, b) => a + b, 0) / CITY_WATER.reduce((a, b) => a + b, 0);
    return [{ v: MONTHS[i], l: "mes más crítico" }, { v: `${ratio.toFixed(1)}×`, l: "vs. promedio CDMX" }, pct];
  }
  if (k === "inundacion") return [{ v: card(addr, k).big, l: "nivel de peligro" }, { v: "Jun–Sep", l: "temporada" }, pct];
  if (k === "granizo") return [{ v: card(addr, k).big, l: "nivel de peligro" }, { v: "May–Ago", l: "temporada" }, pct];
  if (k === "sismo") return [{ v: card(addr, k).big, l: "edificios dañados" }, { v: "500 m", l: "radio" }, pct];
  if (k === "vial") {
    const tot = addr.incidents.reduce((a, b) => a + b, 0);
    return [{ v: `${tot}`, l: "incidentes / año" }, { v: `${(tot / 12 / CITY_INCIDENTS).toFixed(1)}×`, l: "vs. promedio CDMX" }, pct];
  }
  if (k === "ruido") { const [d, n] = addr.values.ruido.match(/\d+/g); return [{ v: `${d} dB`, l: "día" }, { v: `${n} dB`, l: "noche" }, pct]; }
  if (k === "calor") { const t = parseFloat(addr.values.calor); return [{ v: `${t}°`, l: "media anual" }, { v: `${t >= 17.5 ? "+" : ""}${(t - 17.5).toFixed(1)}°`, l: "vs. mediana CDMX" }, pct]; }
  const near = addr.services.filter((s) => s.min != null && s.min <= 15).length;
  return [{ v: `${near}/${addr.services.length}`, l: "servicios a < 15 min" }, { v: `${maxWalk(addr)}′`, l: "el más lejano" }, pct];
}

const PIN = [300, 300];
function heat(addr, k) {
  const r = rng(addr.id.charCodeAt(0) * 13);
  const bad = (100 - addr.scores[k]) / 100;
  if (k === "inundacion") return addr.flood ? [{ x: 170, y: 470, r: 210, c: "text-blue", o: 0.75 }, { x: 330, y: 420, r: 120, c: "text-blue", o: 0.6 }] : [{ x: 80, y: 540, r: 90, c: "text-blue", o: 0.4 }];
  if (k === "granizo") return [{ x: 360, y: 220, r: 240, c: "text-purple", o: 0.2 + bad * 0.5 }];
  if (k === "calor") return [{ x: 300, y: 300, r: 300, c: "text-orange", o: 0.25 + bad * 0.55 }, { x: 260, y: 330, r: 140, c: "text-red", o: bad * 0.6 }];
  if (k === "agua") return [{ x: 300, y: 300, r: 260, c: level(addr.scores.agua).text, o: 0.25 + bad * 0.5 }];
  if (k === "ruido") return [{ line: true, c: "text-orange", o: 0.3 + bad * 0.6 }];
  if (k === "vial") return [[420, 380], [420, 170], [210, 380]].map(([x, y], i) => ({ x, y, r: 30 + addr.hotspots[i].n * 2.2, c: "text-red", o: 0.75 }));
  if (k === "sismo") return Array.from({ length: parseInt(addr.values.sismo, 10) || 0 }, () => ({ x: 300 + (r() - 0.5) * 300, y: 300 + (r() - 0.5) * 300, r: 46, c: "text-red", o: 0.7 }));
  return [{ x: 300, y: 300, r: 165, c: "text-green", o: 0.35 }];
}

function CityMap({ addr, k }) {
  const blobs = heat(addr, k);
  const stats = callout(addr, k);
  const svc = k === "servicios" ? addr.services.filter((s) => s.x != null) : [];
  return (
    <div className="relative h-full min-h-[460px] w-full overflow-hidden rounded-2xl bg-wash">
      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28" /></filter>
        </defs>
        <g transform="rotate(-24 300 300)">
          {Array.from({ length: 26 }, (_, i) => <line key={"a" + i} x1={-300 + i * 46} y1="-300" x2={-300 + i * 46} y2="900" stroke="currentColor" className="text-tertiary" strokeOpacity="0.22" strokeWidth="1.5" />)}
          {Array.from({ length: 40 }, (_, i) => <line key={"b" + i} x1="-300" y1={-300 + i * 30} x2="900" y2={-300 + i * 30} stroke="currentColor" className="text-tertiary" strokeOpacity="0.14" />)}
          <rect x="120" y="96" width="92" height="90" rx="4" className="text-green" fill="currentColor" fillOpacity="0.18" />
          <rect x="400" y="440" width="46" height="60" rx="4" className="text-green" fill="currentColor" fillOpacity="0.18" />
        </g>
        <path d="M-20,600 C60,520 40,430 -20,380" className="text-blue" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="40" />
        <line x1="0" y1="380" x2="600" y2="380" stroke="currentColor" className="text-tertiary" strokeOpacity="0.35" strokeWidth="7" />
        <line x1="420" y1="0" x2="420" y2="600" stroke="currentColor" className="text-tertiary" strokeOpacity="0.35" strokeWidth="7" />
        <g filter="url(#blur)">
          {blobs.map((b, i) => b.line ? (
            <g key={i} className={b.c} stroke="currentColor" strokeOpacity={b.o} strokeWidth="70"><line x1="0" y1="380" x2="600" y2="380" /><line x1="420" y1="0" x2="420" y2="600" /></g>
          ) : <circle key={i} cx={b.x} cy={b.y} r={b.r} className={b.c} fill="currentColor" fillOpacity={b.o * 0.7} />)}
        </g>
        {addr.patrimonio.inZone && <rect x="170" y="150" width="260" height="190" rx="10" className="text-purple" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeDasharray="6 5" />}
        <circle cx={PIN[0]} cy={PIN[1]} r="130" fill="none" stroke="currentColor" className="text-primary" strokeOpacity="0.35" strokeDasharray="3 6" />
        {svc.map((s, i) => {
          const [x, y] = polar(PIN[0], 28 + Math.min(s.min, 25) * 9, 95 + i * 170 / Math.max(svc.length - 1, 1));
          return (
            <g key={s.kind}>
              <circle cx={x} cy={y} r="14" className="text-primary" fill="currentColor" />
              <g transform={`translate(${x - 9},${y - 9}) scale(0.75)`} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-[rgb(var(--bg-elevated))]">{ICONS[SERVICE_ICON(s.kind)]}</g>
            </g>
          );
        })}
        <circle cx={PIN[0]} cy={PIN[1]} r="20" className="text-primary" fill="currentColor" fillOpacity="0.15" />
        <circle cx={PIN[0]} cy={PIN[1]} r="7" className="text-primary" fill="currentColor" stroke="currentColor" strokeWidth="0" />
        <circle cx={PIN[0]} cy={PIN[1]} r="3" className="fill-[rgb(var(--bg-elevated))]" />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(100%+28px)]">
        <div className="flex items-stretch rounded-2xl bg-[rgb(var(--text-primary))] px-2 py-3 text-[rgb(var(--bg-elevated))] shadow-lg">
          {stats.map((st, i) => (
            <div key={i} className={`flex min-w-[88px] flex-col items-center px-3 ${i > 0 ? "border-l border-[rgb(var(--bg-elevated)/0.2)]" : ""}`}>
              <span className="whitespace-nowrap text-[24px] font-light leading-tight">{st.v}</span>
              <span className="whitespace-nowrap text-[10px] opacity-70">{st.l}</span>
            </div>
          ))}
        </div>
        <div className="mx-auto h-3 w-3 -translate-y-1.5 rotate-45 bg-[rgb(var(--text-primary))]" />
      </div>
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 shadow-sm">
        <span className={level(addr.scores[k]).text}><Icon name={k} size={14} /></span>
        <Text size={12} weight="medium">Capa: {DIMS.find((d) => d.key === k).name}</Text>
      </div>
      {addr.patrimonio.inZone && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-purple shadow-sm">
          <Icon name="patrimonio" size={14} /><Text size={11}>Zona patrimonial</Text>
        </div>
      )}
      <div className="absolute bottom-3 right-3 rounded-full bg-elevated px-3 py-1.5 shadow-sm"><Text size={11} className="text-tertiary">Círculo punteado = 500 m · 6 min a pie</Text></div>
    </div>
  );
}

function TopicCard({ addr, k, selected, onClick }) {
  const c = card(addr, k);
  const lv = level(addr.scores[k]);
  return (
    <Button variant="ghost" onClick={onClick}
      className={`!h-auto !justify-start !rounded-2xl !p-0 border ${selected ? "border-[rgb(var(--text-primary))] bg-[rgb(var(--text-primary))] text-[rgb(var(--bg-elevated))] hover:bg-[rgb(var(--text-primary))]" : "border-primary bg-elevated"}`}>
      <div className="flex w-full flex-col items-start gap-3 p-3 text-left">
        <div className="flex w-full items-center justify-between">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? "bg-[rgb(var(--bg-elevated)/0.15)]" : "bg-wash"} ${lv.text}`}><Icon name={k} size={16} /></span>
          <span className="h-2 w-2 rounded-full" style={{ background: lv.color }} />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] opacity-70">{SHORT[k]}</span>
          <span className="text-[24px] font-light leading-none">{c.big}</span>
          <span className="mt-1 text-[10px] opacity-60">{c.unit}</span>
        </div>
      </div>
    </Button>
  );
}

function PercentTrack({ addr, k }) {
  const s = addr.scores[k];
  const lv = level(s);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-wash px-4 pb-3 pt-3">
      <div className="flex items-center justify-between">
        <Text size={12} className="text-secondary">Frente a las colonias de la CDMX</Text>
        <Text size={12} weight="semibold" className={lv.text}>{lv.label}</Text>
      </div>
      <div className="relative mt-5 h-6">
        <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-[rgb(var(--text-tertiary)/0.15)]" />
        <div className="absolute left-0 top-2 h-2 rounded-full" style={{ width: `${s}%`, background: lv.color }} />
        <div className="absolute -top-5 -translate-x-1/2" style={{ left: `${s}%` }}>
          <div className="rounded-md bg-[rgb(var(--text-primary))] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--bg-elevated))]">{s}</div>
        </div>
        <div className="absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 bg-elevated" style={{ left: `${s}%`, borderColor: lv.color }} />
        <div className="absolute inset-x-0 top-5 flex justify-between">
          {["Peor", "Mediana", "Mejor"].map((t) => <Text key={t} size={10} className="text-tertiary">{t}</Text>)}
        </div>
      </div>
    </div>
  );
}

function Compare({ profile, onPick }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ADDRESSES.map((a) => (
          <div key={a.id} className="flex flex-col items-center gap-2">
            <Flower addr={a} profile={profile} size={190} icons={false} />
            <Text size={13} weight="medium">{a.label.split(",")[1].trim()}</Text>
            <Button size="sm" variant="ghost" onClick={() => onPick(a.id)}>Ver reporte</Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {DIMS.map((d) => (
          <div key={d.key} className="grid grid-cols-[140px_1fr_1fr_1fr] items-center">
            <span className="flex items-center gap-2 text-secondary"><Icon name={d.key} size={16} /><Text size={12}>{SHORT[d.key]}</Text></span>
            {ADDRESSES.map((a) => { const s = a.scores[d.key]; return (
              <div key={a.id} className="flex justify-center">
                <div className="rounded-full" style={{ width: 8 + s / 5, height: 8 + s / 5, background: level(s).color, opacity: 0.9 }} title={`${a.values[d.key]}`} />
              </div>); })}
          </div>
        ))}
        <Text size={10} className="text-tertiary">Círculo más grande = mejor que más colonias de la ciudad</Text>
      </div>
    </div>
  );
}

function Report() {
  const [addrId, setAddrId] = useState("a");
  const [profile, setProfile] = useState("equilibrado");
  const [k, setK] = useState("servicios");
  const [view, setView] = useState("resumen");
  const addr = ADDRESSES.find((a) => a.id === addrId);
  const v = verdict(addr);
  const score = profileScore(addr, profile);
  const dim = DIMS.find((d) => d.key === k);
  return (
    <PageLayout title="Antes de rentar" subtitle="Maqueta interactiva con datos ficticios, estilo dashboard con mapa.">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1"><SimpleSelect options={ADDRESSES.map((a) => ({ value: a.id, label: a.label }))} value={addrId} onValueChange={setAddrId} /></div>
        <SegmentedControl value={view} onValueChange={(x) => x && setView(x)} size="small" variant="rounded">
          <SegmentedControlItem value="resumen">Reporte</SegmentedControlItem>
          <SegmentedControlItem value="comparar">Comparar</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div className="flex gap-1 rounded-xl bg-wash p-1">
        {Object.keys(PROFILES).map((key) => (
          <Button key={key} size="sm" variant={profile === key ? "primary" : "ghost"} className="flex-1" onClick={() => setProfile(key)}>{PROFILE_SHORT[key]}</Button>
        ))}
      </div>

      {view === "resumen" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 rounded-2xl border border-primary bg-elevated p-3">
              <Flower addr={addr} profile={profile} size={92} icons={false} />
              <div className="flex flex-col gap-0.5">
                <Text size={11} className="text-tertiary">Puntaje para ti</Text>
                <span className="text-[13px]"><span className={`text-[34px] font-light leading-none ${level(score).text}`}>{score}</span><span className="text-tertiary"> / 100</span></span>
                {v.best.length > 0 && <Text size={11} className="text-secondary"><span className="text-green">Destaca:</span> {v.best.join(", ")}</Text>}
                {v.worst.length > 0 && <Text size={11} className="text-secondary"><span className="text-red">Revisa:</span> {v.worst.join(", ")}</Text>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DIMS.map((d) => <TopicCard key={d.key} addr={addr} k={d.key} selected={k === d.key} onClick={() => setK(d.key)} />)}
            </div>
            <PercentTrack addr={addr} k={k} />
            {dim.ask.length > 0 && (
              <CollapsibleRoot key={k}>
                <CollapsibleTrigger><Text size={12} weight="medium">Pregunta al arrendador ({dim.ask.length})</Text></CollapsibleTrigger>
                <CollapsiblePanel>
                  <div className="mt-2 flex flex-col gap-1">{dim.ask.map((q) => <Text key={q} size={12} className="text-secondary">{q}</Text>)}</div>
                </CollapsiblePanel>
              </CollapsibleRoot>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex-1"><CityMap addr={addr} k={k} /></div>
            <Button variant="primary" size="lg" className="w-full !rounded-2xl">Compartir reporte por WhatsApp</Button>
          </div>
        </div>
      )}
      {view === "comparar" && <Compare profile={profile} onPick={(id) => { setAddrId(id); setView("resumen"); }} />}

      <Footnote>Datos y mapa ficticios. Fuentes previstas: Portal de Datos Abiertos CDMX (SACMEX, SGIRPC, C5, SSC, SEDEMA, SEDUVI). {dim.source}.</Footnote>
    </PageLayout>
  );
}
render(<Report />);
</script>
