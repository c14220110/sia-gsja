'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Constants ────────────────────────────────────────────────────────────────
const W  = 176;   // node card width
const H  = 145;   // node card height
const HG = 220;   // horizontal gap between node centers (node + space)
const VG = 240;   // vertical gap between levels

// ─── Types ────────────────────────────────────────────────────────────────────
interface NodeItem {
  id: string;
  jemaat: any;
  role: string;
  x: number;
  y: number;
  unregistered?: boolean;
}

/** Simple point-to-point edge (marriage bar, anak arrows, etc.) */
interface EdgeItem {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  label: string;
  dashed?: boolean;
  horizontal?: boolean;
  noArrow?: boolean;
}

/**
 * A proper family-tree "trunk + branch" connector.
 * Draws: single trunk from parent midpoint → horizontal branch bar → stubs to each child.
 */
export interface FamilyBranch {
  id: string;
  trunkX: number;    // center X of the trunk (midpoint between parents)
  topY: number;      // Y where trunk starts (bottom of parent row)
  branchY: number;   // Y of the horizontal branch bar
  childXs: number[]; // center X of each child node
  bottomY: number;   // Y where stubs end (top of child row)
  dashed?: boolean;  // dashed when parents are unregistered
}

// ─── Layout builder ───────────────────────────────────────────────────────────
export function buildGraph(data: any): { nodes: NodeItem[]; edges: EdgeItem[]; branches: FamilyBranch[] } {
  const nodes: NodeItem[]       = [];
  const edges: EdgeItem[]       = [];
  const branches: FamilyBranch[]= [];
  let counter = 0;

  const posMap: Record<string, { x: number; y: number }> = {};

  function addNode(jemaat: any, role: string, x: number, y: number, unregistered = false): string {
    const id = `n${counter++}`;
    nodes.push({ id, jemaat, role, x, y, unregistered });
    posMap[id] = { x, y };
    return id;
  }

  function addEdge(from: string, to: string, color: string, label: string, dashed = false, horizontal = false, noArrow = false) {
    const s = posMap[from];
    const t = posMap[to];
    if (!s || !t) return;
    edges.push({
      id: `e-${from}-${to}`,
      x1: horizontal ? s.x + W     : s.x + W / 2,
      y1: horizontal ? s.y + H / 2 : s.y + H,
      x2: horizontal ? t.x         : t.x + W / 2,
      y2: horizontal ? t.y + H / 2 : t.y,
      color, label, dashed, horizontal, noArrow,
    });
  }

  const saudara = data.saudara || [];
  const anak    = data.anak    || [];

  // ── ROW 0: saudara ... PERSON ... pasangan ──────────────────────────────────
  const personCol = saudara.length;
  const personX   = personCol * HG;
  const personY   = 0;

  const saudaraIds: string[] = [];
  saudara.forEach((s: any, i: number) => {
    saudaraIds.push(addNode(s, 'saudara', i * HG, 0));
  });

  const personId = addNode(data.person, 'person', personX, personY);

  let pasanganId: string | null = null;
  if (data.pasangan) {
    pasanganId = addNode(data.pasangan, 'pasangan', (personCol + 1) * HG, 0);
    // Horizontal marriage arrow: person ↔ pasangan
    addEdge(personId, pasanganId, '#f43f8e', 'Pasangan', false, true);
  } else if (data.person?.pasangan_nama) {
    const fakePasangan = { id: -3, nama_lengkap: data.person.pasangan_nama, jenis_kelamin: data.person?.jenis_kelamin === 'Laki-laki' ? 'Perempuan' : 'Laki-laki' };
    pasanganId = addNode(fakePasangan, 'pasangan', (personCol + 1) * HG, 0, true);
    addEdge(personId, pasanganId, '#f43f8e', 'Pasangan', false, true);
  }

  // Saudara ↔ person: horizontal dashed "sibling" connector
  saudaraIds.forEach(sid => {
    const s = posMap[sid];
    const p = posMap[personId];
    edges.push({
      id: `e-${sid}-${personId}`,
      x1: s.x + W, y1: s.y + H / 2,
      x2: p.x,     y2: p.y + H / 2,
      color: '#f59e0b', label: 'Saudara', horizontal: true, dashed: true,
    });
  });

  // ── ROW -1: Ayah & Ibu ──────────────────────────────────────────────────────
  const leftCenter  = saudara.length > 0 ? 0 : personX;
  const rightCenter = personX;
  const midCenter   = (leftCenter + rightCenter) / 2;

  let ayahId: string | null = null;
  let ibuId:  string | null = null;

  if (data.ayah) {
    ayahId = addNode(data.ayah, 'ayah', midCenter - HG * 0.5, -VG);
  } else if (data.person?.ayah_nama) {
    const fakeAyah = { id: -1, nama_lengkap: data.person.ayah_nama, jenis_kelamin: 'Laki-laki' };
    ayahId = addNode(fakeAyah, 'ayah', midCenter - HG * 0.5, -VG, true);
  }

  if (data.ibu) {
    ibuId = addNode(data.ibu, 'ibu', midCenter + HG * 0.5, -VG);
  } else if (data.person?.ibu_nama) {
    const fakeIbu = { id: -2, nama_lengkap: data.person.ibu_nama, jenis_kelamin: 'Perempuan' };
    ibuId = addNode(fakeIbu, 'ibu', midCenter + HG * 0.5, -VG, true);
  }

  // Marriage bar: horizontal line between Ayah and Ibu (no arrow, just a coupling line)
  if (ayahId && ibuId) {
    addEdge(ayahId, ibuId, '#f43f8e', '', false, true, true);
  }

  // ── Family branch: trunk → branch bar → stubs to all children ────────────────
  if (ayahId || ibuId) {
    // trunkX = midpoint between the two parent node centers
    let trunkX: number;
    if (ayahId && ibuId) {
      trunkX = (posMap[ayahId].x + W / 2 + posMap[ibuId].x + W / 2) / 2;
    } else if (ayahId) {
      trunkX = posMap[ayahId].x + W / 2;
    } else {
      trunkX = posMap[ibuId!].x + W / 2;
    }

    const trunkTopY  = -VG + H;            // bottom of parent row
    const branchY    = trunkTopY + (-VG + H - personY === 0 ? 0 : (personY - trunkTopY) * 0.5);
    // Actually simpler:
    // trunkTopY = -VG + H  (e.g. -240+145 = -95)
    // personY   = 0
    // branchY   = midpoint = (-95 + 0) / 2 = ~-47

    // All children: saudara first, then person
    const allChildIds = [...saudaraIds, personId];
    const childXs     = allChildIds.map(id => posMap[id].x + W / 2);

    branches.push({
      id: 'parent-children',
      trunkX,
      topY: -VG + H,
      branchY: (-VG + H + personY) / 2,
      childXs,
      bottomY: personY,
      dashed: !data.ayah && !data.ibu, // dashed if both parents unregistered
    });
  }

  // ── ROW -2: Kakek & Nenek ────────────────────────────────────────────────────
  const ayahX = ayahId ? (posMap[ayahId]?.x ?? midCenter - HG * 0.5) : midCenter - HG * 0.5;
  const ibuX  = ibuId  ? (posMap[ibuId]?.x  ?? midCenter + HG * 0.5) : midCenter + HG * 0.5;

  const kkAyah = data.kakek_nenek?.ayah?.kakek;
  const nkAyah = data.kakek_nenek?.ayah?.nenek;
  const kkIbu  = data.kakek_nenek?.ibu?.kakek;
  const nkIbu  = data.kakek_nenek?.ibu?.nenek;

  if (kkAyah) {
    const id = addNode(kkAyah, 'kakek_ayah', ayahX - HG * 0.5, -VG * 2);
    if (ayahId) addEdge(id, ayahId, '#60a5fa', 'Kakek', true);
  }
  if (nkAyah) {
    const id = addNode(nkAyah, 'nenek_ayah', ayahX + HG * 0.5, -VG * 2);
    if (ayahId) addEdge(id, ayahId, '#f9a8d4', 'Nenek', true);
  }
  if (kkIbu) {
    const id = addNode(kkIbu, 'kakek_ibu', ibuX - HG * 0.5, -VG * 2);
    if (ibuId) addEdge(id, ibuId, '#60a5fa', 'Kakek', true);
  }
  if (nkIbu) {
    const id = addNode(nkIbu, 'nenek_ibu', ibuX + HG * 0.5, -VG * 2);
    if (ibuId) addEdge(id, ibuId, '#f9a8d4', 'Nenek', true);
  }

  // ── ROW +1: Anak — use trunk+branch to avoid crossing arrows ─────────────────
  if (anak.length > 0) {
    const childCenterX = pasanganId ? personX + HG / 2 : personX;
    const anakIds: string[] = [];

    anak.forEach((a: any, i: number) => {
      const isReg  = !!a.id;
      const jemaat = isReg ? a : { id: -(1000 + i), nama_lengkap: a.nama_anak || 'Anak' };
      const ax     = childCenterX + (i - (anak.length - 1) / 2) * HG;
      anakIds.push(addNode(jemaat, 'anak', ax, VG, !isReg));
    });

    // Trunk X = midpoint between person center and pasangan center (or just person)
    const anakTrunkX = pasanganId
      ? (posMap[personId].x + W / 2 + posMap[pasanganId].x + W / 2) / 2
      : posMap[personId].x + W / 2;

    branches.push({
      id: 'person-anak',
      trunkX: anakTrunkX,
      topY:    personY + H,
      branchY: personY + H + (VG - H) / 2,
      childXs: anakIds.map(id => posMap[id].x + W / 2),
      bottomY: personY + VG,
      dashed: false,
    });
  }

  return { nodes, edges, branches };
}

// ─── Helper fns ──────────────────────────────────────────────────────────────
function getAge(t?: string | null) {
  if (!t) return '';
  const a = Math.floor((Date.now() - new Date(t).getTime()) / 3.156e10);
  return `${a} thn`;
}
function getMarga(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? p[p.length - 1] : '';
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase();
}

// ─── Person Card ──────────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, string> = {
  person: 'Pusat', ayah: 'Ayah', ibu: 'Ibu', pasangan: 'Pasangan',
  anak: 'Anak', saudara: 'Saudara', kakek_ayah: 'Kakek (Ayah)',
  nenek_ayah: 'Nenek (Ayah)', kakek_ibu: 'Kakek (Ibu)', nenek_ibu: 'Nenek (Ibu)',
};
const ROLE_COLOR: Record<string, string> = {
  person: '#14b8a6', pasangan: '#f43f8e', ayah: '#3b82f6', ibu: '#ec4899',
  anak: '#8b5cf6', saudara: '#f59e0b', kakek_ayah: '#60a5fa', nenek_ayah: '#f9a8d4',
  kakek_ibu: '#60a5fa', nenek_ibu: '#f9a8d4',
};

function PersonCard({ node, onClick }: { node: NodeItem; onClick: () => void }) {
  const { jemaat, role, unregistered } = node;
  const color  = ROLE_COLOR[role] || '#94a3b8';
  const isMale = jemaat?.jenis_kelamin === 'Laki-laki';
  const avBg   = role === 'person' ? '#0d9488' : isMale ? '#3b82f6' : '#ec4899';

  return (
    <div
      onClick={onClick}
      style={{ width: W, border: `2px solid ${color}`, borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: role === 'person' ? `0 4px 20px ${color}40` : '0 2px 8px rgba(0,0,0,0.1)', cursor: unregistered ? 'default' : 'pointer', userSelect: 'none' }}
    >
      <div style={{ background: color, color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '3px 6px', letterSpacing: 0.6 }}>
        {ROLE_BADGE[role] || role}
      </div>
      <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, opacity: unregistered ? 0.4 : 1, flexShrink: 0 }}>
          {initials(jemaat?.nama_lengkap || '?')}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {jemaat?.nama_lengkap || 'Tidak diketahui'}
          </div>
          {getMarga(jemaat?.nama_lengkap || '') && (
            <span style={{ fontSize: 9, background: '#f1f5f9', color: '#64748b', borderRadius: 99, padding: '1px 6px', marginTop: 2, display: 'inline-block' }}>
              {getMarga(jemaat?.nama_lengkap || '')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
          {jemaat?.jenis_kelamin && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: isMale ? '#eff6ff' : '#fdf2f8', color: isMale ? '#3b82f6' : '#ec4899', fontWeight: 600 }}>
              {isMale ? '♂ L' : '♀ P'}
            </span>
          )}
          {jemaat?.tanggal_lahir && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: '#f8fafc', color: '#64748b' }}>
              {getAge(jemaat.tanggal_lahir)}
            </span>
          )}
          {!unregistered && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: jemaat?.status_jemaat === 'Aktif' ? '#f0fdf4' : '#f8fafc', color: jemaat?.status_jemaat === 'Aktif' ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
              {jemaat?.status_jemaat || '-'}
            </span>
          )}
          {unregistered && <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>Belum terdaftar</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Regular edge (bezier or horizontal) ─────────────────────────────────────
function EdgePath({ edge }: { edge: EdgeItem }) {
  const { x1, y1, x2, y2, color, label, dashed, horizontal, noArrow } = edge;

  let d: string;
  if (horizontal) {
    d = `M ${x1} ${y1} L ${x2} ${y2}`;
  } else {
    const midy = y1 + (y2 - y1) * 0.5;
    d = `M ${x1} ${y1} C ${x1} ${midy}, ${x2} ${midy}, ${x2} ${y2}`;
  }

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '6,4' : undefined}
        markerEnd={noArrow ? undefined : `url(#arrow-${color.slice(1)})`}
        opacity={0.8}
      />
      {label && (
        <>
          <rect x={mx - 20} y={my - 9} width={40} height={16} rx={4} fill="white" fillOpacity={0.85} />
          <text x={mx} y={my + 3.5} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight={600}>{label}</text>
        </>
      )}
    </g>
  );
}

// ─── Family branch: trunk → horizontal bar → stubs ───────────────────────────
function FamilyBranchPath({ branch }: { branch: FamilyBranch }) {
  const { trunkX, topY, branchY, childXs, bottomY, dashed } = branch;
  if (childXs.length === 0) return null;

  const color = '#94a3b8';
  const da    = dashed ? '5,4' : undefined;
  const minCX = Math.min(...childXs);
  const maxCX = Math.max(...childXs);
  const ARROW = 8;

  return (
    <g opacity={0.85}>
      {/* Trunk: vertical from parent bottom to branch level */}
      <line x1={trunkX} y1={topY} x2={trunkX} y2={branchY}
        stroke={color} strokeWidth={2} strokeDasharray={da} />

      {/* Horizontal branch bar spanning all children */}
      {childXs.length > 1 && (
        <line x1={minCX} y1={branchY} x2={maxCX} y2={branchY}
          stroke={color} strokeWidth={2} strokeDasharray={da} />
      )}

      {/* Vertical stubs from branch bar down to each child with arrowhead */}
      {childXs.map((cx, i) => (
        <g key={i}>
          <line x1={cx} y1={branchY} x2={cx} y2={bottomY}
            stroke={color} strokeWidth={2} strokeDasharray={da} />
          <polygon
            points={`${cx - 5},${bottomY - ARROW} ${cx + 5},${bottomY - ARROW} ${cx},${bottomY}`}
            fill={color}
          />
        </g>
      ))}
    </g>
  );
}

// ─── Main canvas with pan + zoom ──────────────────────────────────────────────
interface Props {
  nodes: NodeItem[];
  edges: EdgeItem[];
  branches?: FamilyBranch[];
  onNodeClick?: (jemaatId: number) => void;
}

export default function FlowCanvas({ nodes, edges, branches = [], onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan]   = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + W;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + H;
    const treeW = maxX - minX;
    const treeH = maxY - minY;
    const scaleX = rect.width  / (treeW + 80);
    const scaleY = rect.height / (treeH + 80);
    const s = Math.min(scaleX, scaleY, 1);
    setZoom(s);
    setPan({
      x: (rect.width  - treeW * s) / 2 - minX * s,
      y: (rect.height - treeH * s) / 2 - minY * s,
    });
  }, [nodes]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp   = useCallback(() => { dragging.current = false; }, []);
  const onWheel     = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(2.5, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const uniqueColors = [...new Set(edges.filter(e => !e.noArrow).map(e => e.color.slice(1)))];

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: 'grab', background: '#f8fafc' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* SVG layer */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          {uniqueColors.map(c => (
            <marker key={c} id={`arrow-${c}`} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={`#${c}`} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Family branch connectors (render below regular edges) */}
          {branches.map(b => <FamilyBranchPath key={b.id} branch={b} />)}
          {/* Regular edges */}
          {edges.map(e => <EdgePath key={e.id} edge={e} />)}
        </g>
      </svg>

      {/* Node layer */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute' }}>
          {nodes.map(node => (
            <div
              key={node.id}
              data-node="true"
              style={{ position: 'absolute', left: node.x, top: node.y, width: W, pointerEvents: 'auto' }}
            >
              <PersonCard
                node={node}
                onClick={() => !node.unregistered && node.jemaat?.id > 0 && onNodeClick?.(node.jemaat.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        {[{ label: '+', delta: 1.2 }, { label: '−', delta: 0.8 }].map(btn => (
          <button
            key={btn.label}
            onClick={() => setZoom(z => Math.max(0.2, Math.min(2.5, z * btn.delta)))}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          >
            {btn.label}
          </button>
        ))}
        <button
          onClick={() => {
            if (!containerRef.current || nodes.length === 0) return;
            const rect = containerRef.current.getBoundingClientRect();
            const xs = nodes.map(n => n.x); const ys = nodes.map(n => n.y);
            const minX = Math.min(...xs); const maxX = Math.max(...xs) + W;
            const minY = Math.min(...ys); const maxY = Math.max(...ys) + H;
            const treeW = maxX - minX; const treeH = maxY - minY;
            const s = Math.min(rect.width / (treeW + 80), rect.height / (treeH + 80), 1);
            setZoom(s);
            setPan({ x: (rect.width - treeW * s) / 2 - minX * s, y: (rect.height - treeH * s) / 2 - minY * s });
          }}
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          title="Reset view"
        >
          ⊡
        </button>
      </div>
    </div>
  );
}
