export interface AudioFile {
  id: string;
  name: string;
  url: string;
  session: string;
}

// Automatically load all audio files located in src/utils/audio/ including subdirectories
const audioModules = import.meta.glob('/src/utils/audio/**/*.{mp3,wav,ogg,m4a}', { 
  eager: true, 
  query: '?url',
  import: 'default'
});

export function getLocalAudioFiles(): AudioFile[] {
  const files: AudioFile[] = Object.entries(audioModules).map(([path, url]) => {
    // path e.g. "/src/utils/audio/Session_1/song.mp3" or "/src/utils/audio/song.mp3"
    // Remove the prefix to get the relative path
    const relativePath = path.replace('/src/utils/audio/', '');
    const parts = relativePath.split('/');
    
    // If length > 1, the first part is the folder/session name
    // If length === 1, it's just the file in the root directory
    const sessionName = parts.length > 1 ? parts[0] : 'Others';
    const name = parts.pop() || 'Unknown Audio';
    
    return {
      id: path,
      name,
      url: url as string,
      session: sessionName
    };
  });
  
  // Sort files numerically using natural sorting (case-insensitive, Vietnamese locale)
  return files.sort((a, b) => {
    if (a.session === b.session) {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi', { numeric: true });
    }
    return a.session.toLowerCase().localeCompare(b.session.toLowerCase(), 'vi', { numeric: true });
  });
}
