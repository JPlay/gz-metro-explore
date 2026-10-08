// 车站注册表：数据 + 关卡类。沿 1 号线上行（往广州东站）依次排列。
// 颜色是游戏里的粉彩主题色（站体色系参考旧项目 config.js 的核对结果，非官方色号）。
import { StationGongyuanqian } from './station-gongyuanqian.js';
import { StationNongjiangsuo } from './station-nongjiangsuo.js';
import { StationLieshilingyuan } from './station-lieshilingyuan.js';
import { StationDongshankou } from './station-dongshankou.js';

export const STATIONS = [
  {
    id: 'gyq', zh: '公园前', en: 'Gongyuanqian', emblem: '🌳', color: 0x8fcf9a, cssColor: '#8fcf9a',
    landmark: '人民公园 · 换乘 2 号线', Scene: StationGongyuanqian,
    theme: { top: '#cdeedd', bottom: '#fdf4dc', fog: 0xf6f3de },
    palette: { floor: 0xfff4de, tile: 0xf9e8b0, stair: 0xfff9ec, base: 0xbfe3c4, baseDeep: 0x9fd0a8, portal: 0xe9e2cf }
  },
  {
    id: 'njs', zh: '农讲所', en: 'Peasant Movement Institute', emblem: '🏮', color: 0xd9706a, cssColor: '#e0857c',
    landmark: '农民运动讲习所旧址 · 红墙庭院', Scene: StationNongjiangsuo,
    theme: { top: '#fbd9c9', bottom: '#fdf0e3', fog: 0xfbe9dc },
    palette: { floor: 0xf3e3c6, tile: 0xf8efe0, stair: 0xfaf2e6, base: 0xeccab4, baseDeep: 0xdcae94, portal: 0xd9706a }
  },
  {
    id: 'lsly', zh: '烈士陵园', en: "Martyrs' Park", emblem: '🌺', color: 0xc8aa6e, cssColor: '#d4b87e',
    landmark: '起义烈士陵园 · 花园与纪念牌坊', Scene: StationLieshilingyuan,
    theme: { top: '#d6ecdc', bottom: '#fbf6ea', fog: 0xeef3e4 },
    palette: { floor: 0xe8e0cf, tile: 0xf4efe4, stair: 0xf6f1e6, base: 0xc3e2c2, baseDeep: 0xa6cfa8, portal: 0xd9d2c5 }
  },
  {
    id: 'dsk', zh: '东山口', en: 'Dongshankou', emblem: '🏡', color: 0xd98b6c, cssColor: '#e09a7c',
    landmark: '东山洋楼 · 红砖与坡屋顶', Scene: StationDongshankou,
    theme: { top: '#f3d9e6', bottom: '#fbe9d6', fog: 0xf6e3dc },
    palette: { floor: 0xf4e6cf, tile: 0xf9efdd, stair: 0xfbf3e6, base: 0xe9d3c6, baseDeep: 0xd6b8a8, portal: 0xd98b6c }
  }
];
export function stationById(id) { return STATIONS.find(s => s.id === id); }
export function stationIndex(id) { return STATIONS.findIndex(s => s.id === id); }
