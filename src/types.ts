export interface SoopAudioOptions {
  url: string;
  output?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface M3U8Info {
  url: string;
  segments: string[];
  isMasterPlaylist: boolean;
  variants?: M3U8Variant[];
}

export interface M3U8Variant {
  uri: string;
  bandwidth?: number;
  resolution?: string;
  codecs?: string;
  audioGroup?: string;
}

