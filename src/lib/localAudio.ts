export interface AudioFile {
  id: string;
  name: string;
  url: string;
  session: string;
}

// Automatically load all audio files located in src/utils/audio/ including subdirectories
const audioModules = import.meta.glob('/src/utils/audio/**/*.{mp3,wav,ogg,m4a}', { 
  query: '?url',
  import: 'default'
});

export async function getLocalAudioFiles(): Promise<AudioFile[]> {
  const filesPromises = Object.entries(audioModules).map(async ([path, getUrl]) => {
    // path e.g. "/src/utils/audio/Session_1/song.mp3" or "/src/utils/audio/song.mp3"
    // Remove the prefix to get the relative path
    const relativePath = path.replace('/src/utils/audio/', '');
    const parts = relativePath.split('/');
    
    // If length > 1, the first part is the folder/session name
    // If length === 1, it's just the file in the root directory
    const sessionName = parts.length > 1 ? parts[0] : 'Others';
    const name = parts.pop() || 'Unknown Audio';
    
    // Dynamic import to get the resolved URL (this prevents Vite from pre-bundling all files)
    const url = await (getUrl as () => Promise<string>)();
    
    return {
      id: path,
      name,
      url,
      session: sessionName
    };
  });
  
  const files = await Promise.all(filesPromises);
  
  // Sort files numerically using natural sorting (case-insensitive, Vietnamese locale)
  return files.sort((a, b) => {
    if (a.session === b.session) {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi', { numeric: true });
    }
    return a.session.toLowerCase().localeCompare(b.session.toLowerCase(), 'vi', { numeric: true });
  });
}
