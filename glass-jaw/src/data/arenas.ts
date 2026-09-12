export interface ArenaDef {
  id: string;
  name: string;
  location: string;
  description: string;
  /** Two-stop backdrop gradient. */
  sky: [string, string];
  /**
   * Ring canvas colour.
   *
   * Kept dark and low-chroma on purpose. The mat is the single largest area
   * of the screen, and a saturated one turns the whole frame into that colour
   * and drags every fighter's palette toward it. The ring should sit back and
   * let the boxers be the brightest thing in the room.
   */
  mat: string;
  matAccent: string;
  /** Rope colours, bottom to top. */
  ropes: [string, string, string];
  /** Corner post colour. */
  post: string;
  /** Crowd silhouette base. */
  crowd: string;
  /** Ambient light tint applied to fighters. */
  light: string;
  /** Rim light colour. */
  rim: string;
  /** Crowd density, 0..1. */
  density: number;
  /** Camera flashes per second. */
  flashRate: number;
  /** Whether the floor reflects the fighters. */
  reflective: boolean;
  unlockedBy: string | null;
}

export const ARENAS: Record<string, ArenaDef> = {
  gym: {
    id: 'gym',
    name: "Kovac's Gym",
    location: 'Hometown',
    description: 'Bare bulbs, a heavy bag with the stuffing showing, and about forty people who have known you since you were nine.',
    sky: ['#2b2418', '#120e08'],
    mat: '#2a5279', matAccent: '#3f6f9e',
    ropes: ['#d94f4f', '#e8e8e8', '#4a7fd4'],
    post: '#3a3a44',
    crowd: '#1a1610',
    light: '#ffd9a0', rim: '#ff9a3c',
    density: 0.55, flashRate: 0.25, reflective: false,
    unlockedBy: null,
  },
  civic: {
    id: 'civic',
    name: 'Civic Auditorium',
    location: 'Downtown',
    description: 'Sold out, loud, and finally televised. Somebody in the third row has a sign with your name spelled wrong.',
    sky: ['#1b2340', '#080b17'],
    mat: '#5a2b42', matAccent: '#8a4666',
    ropes: ['#f0f0f0', '#d94f4f', '#f0f0f0'],
    post: '#4a4458',
    crowd: '#141a2c',
    light: '#e8e4ff', rim: '#4cc9f0',
    density: 0.78, flashRate: 1.1, reflective: true,
    unlockedBy: 'kip',
  },
  dome: {
    id: 'dome',
    name: 'The Dome',
    location: 'International',
    description: 'Eighteen thousand people, four languages of booing, and a light rig you can feel on your shoulders.',
    sky: ['#0f1d2e', '#03060d'],
    mat: '#1b5757', matAccent: '#2f8080',
    ropes: ['#4cc9f0', '#f0f0f0', '#4cc9f0'],
    post: '#2a3a4a',
    crowd: '#0a1420',
    light: '#d8f0ff', rim: '#7ef9a2',
    density: 0.9, flashRate: 2.2, reflective: true,
    unlockedBy: 'rico',
  },
  coliseum: {
    id: 'coliseum',
    name: 'Grand Coliseum',
    location: 'Championship Grounds',
    description: 'The room where the belts live. The lights go out except for one, and the one is on you.',
    sky: ['#2a0f1e', '#0a0308'],
    mat: '#551a22', matAccent: '#8a2837',
    ropes: ['#f4c430', '#f0f0f0', '#f4c430'],
    post: '#5a4020',
    crowd: '#160a10',
    light: '#fff0d0', rim: '#f4c430',
    density: 1, flashRate: 3.4, reflective: true,
    unlockedBy: 'mcgraw',
  },
};

export const ARENA_LIST = Object.values(ARENAS);
export function getArena(id: string): ArenaDef {
  return ARENAS[id] ?? ARENAS.gym;
}
