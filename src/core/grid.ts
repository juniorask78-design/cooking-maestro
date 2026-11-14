import { MAP, TILE, HUD_HEIGHT, CRATE_ORDER } from '../config/content';

export type StationType = 'crate' | 'plates' | 'counter' | 'board' | 'stove' | 'trash' | 'table';

export interface StationSpec {
  id: string; // ex. "s-0-5"
  type: StationType;
  tx: number;
  ty: number;
  /** Ingrédient d'une caisse. */
  ingredient?: string;
  /** Ordre d'apparition pour les tables/poêles déblocables (0, 1, 2…). */
  index: number;
}

export interface Tile { x: number; y: number }

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly stations: StationSpec[] = [];
  readonly door: Tile = { x: 0, y: 0 };
  private blocked: boolean[][];

  constructor(map: string[] = MAP) {
    this.h = map.length;
    this.w = map[0].length;
    this.blocked = [];
    const counters: Record<string, number> = {};
    for (let y = 0; y < this.h; y++) {
      this.blocked.push([]);
      for (let x = 0; x < this.w; x++) {
        const c = map[y][x];
        let type: StationType | null = null;
        let ingredient: string | undefined;
        if (c === 'c') { type = 'crate'; ingredient = CRATE_ORDER[counters.crate ?? 0]; }
        else if (c === 'p') type = 'plates';
        else if (c === '=') type = 'counter';
        else if (c === 'x') type = 'board';
        else if (c === 's') type = 'stove';
        else if (c === 't') type = 'trash';
        else if (c === 'T') type = 'table';
        if (c === 'D') { this.door.x = x; this.door.y = y; }
        this.blocked[y].push(c === '#' || type !== null);
        if (type) {
          const index = counters[type] ?? 0;
          counters[type] = index + 1;
          this.stations.push({ id: `${type}-${x}-${y}`, type, tx: x, ty: y, ingredient, index });
        }
      }
    }
  }

  isBlocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return this.blocked[y][x];
  }

  stationAt(x: number, y: number): StationSpec | undefined {
    return this.stations.find((s) => s.tx === x && s.ty === y);
  }

  /** Plus court chemin (BFS, 4 directions) entre deux cases libres. */
  path(from: Tile, to: Tile): Tile[] | null {
    if (this.isBlocked(to.x, to.y)) return null;
    const key = (t: Tile) => t.y * this.w + t.x;
    const prev = new Map<number, number>();
    const start = key(from);
    prev.set(start, -1);
    const queue: Tile[] = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.x === to.x && cur.y === to.y) {
        const out: Tile[] = [];
        let k = key(cur);
        while (k !== start) {
          out.unshift({ x: k % this.w, y: Math.floor(k / this.w) });
          k = prev.get(k)!;
        }
        return out;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: cur.x + dx, y: cur.y + dy };
        if (this.isBlocked(n.x, n.y) || prev.has(key(n))) continue;
        prev.set(key(n), key(cur));
        queue.push(n);
      }
    }
    return null;
  }

  /** Cases libres voisines d'une station, triées par distance à `from`. */
  freeNeighbours(s: { tx: number; ty: number }, from?: Tile): Tile[] {
    const out = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dy]) => ({ x: s.tx + dx, y: s.ty + dy }))
      .filter((t) => !this.isBlocked(t.x, t.y));
    if (from) out.sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)));
    return out;
  }
}

export const tileCenter = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 + HUD_HEIGHT });
export const worldToTile = (x: number, y: number): Tile => ({ x: Math.floor(x / TILE), y: Math.floor((y - HUD_HEIGHT) / TILE) });
