/**
 * COOP EN LIGNE — contrat réseau (pas encore branché dans le prototype).
 *
 * Modèle « hôte fait foi » : le joueur qui ouvre la salle fait tourner KitchenSim.
 * Les invités envoient leurs `Action` ; l'hôte diffuse un instantané de l'état ~10 fois/s.
 * Transport prévu : Supabase Realtime (canal de broadcast par salle, présence pour le lobby).
 * Voir docs/ARCHITECTURE.md.
 */
import type { Action, KitchenSim } from '../core/sim';

export interface RoomInfo { code: string; hostId: string; players: { id: string; name: string }[] }

export interface Snapshot {
  t: number;
  slots: KitchenSim['slots'];
  plates: KitchenSim['plates'];
  customers: KitchenSim['customers'];
  coins: number;
}

export interface CoopTransport {
  createRoom(playerName: string): Promise<RoomInfo>;
  joinRoom(code: string, playerName: string): Promise<RoomInfo>;
  /** Invité -> hôte */
  sendAction(a: Action): void;
  onAction(cb: (a: Action) => void): void;
  /** Hôte -> invités */
  sendSnapshot(s: Snapshot): void;
  onSnapshot(cb: (s: Snapshot) => void): void;
  leave(): Promise<void>;
}

/** Instantané sérialisable d'une simulation, envoyé par l'hôte. */
export function snapshotOf(sim: KitchenSim): Snapshot {
  return {
    t: sim.time,
    slots: sim.slots,
    plates: sim.plates,
    customers: sim.customers,
    coins: sim.coins,
  };
}
