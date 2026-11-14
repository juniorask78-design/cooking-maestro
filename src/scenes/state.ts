import type Phaser from 'phaser';
import type { SaveData } from '../core/progress';
import { LocalSaveService, CloudSaveService, type SaveService } from '../core/save';
import { createCloudBackend } from '../net/supabase';

/** Accès partagé à la sauvegarde courante entre les scènes. */
export const Session = {
  save: null as SaveData | null,
  service: new LocalSaveService() as SaveService,
  async init() {
    const cloud = await createCloudBackend().catch(() => null);
    if (cloud) this.service = new CloudSaveService(cloud);
    this.save = await this.service.load();
  },
  get data(): SaveData {
    if (!this.save) throw new Error('Sauvegarde non chargée');
    return this.save;
  },
  persist() {
    if (this.save) void this.service.save(this.save);
  },
};

export function fadeTo(scene: Phaser.Scene, key: string, data?: object) {
  scene.cameras.main.fadeOut(220, 43, 35, 64);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
