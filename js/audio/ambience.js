// 场景 → 环境声区。素材复用旧项目的 CC0 衍生环境声（见 assets/audio/CREDITS.md）。
import * as Audio from './audio.js';

const ZONES = { title: 'street', hub: 'street', station: 'concourse', platform: 'platform', ride: 'train', none: 'none' };
export function setScene(kind) { Audio.setZone(ZONES[kind] || 'none'); if (kind !== 'ride') Audio.trainSound({ speed: 0 }); }
/** 行车：每帧更新列车声（速度 0..1） */
export function ride(speed, braking) { Audio.trainSound({ speed, inside: true, braking }); }
