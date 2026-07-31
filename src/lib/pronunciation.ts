type DictionaryPhonetic = { audio?: string };
type DictionaryEntry = { phonetics?: DictionaryPhonetic[] };

export function isEnglishWord(text: string): boolean {
  return /^[A-Za-z0-9\s'\-.,!?]+$/.test(text.trim());
}

export function selectEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const preferred = ['Google UK English Female', 'Google US English'];
  for (const name of preferred) {
    const voice = voices.find(item => item.name === name);
    if (voice) return voice;
  }
  return voices.find(item => item.lang === 'en-US') || voices.find(item => item.lang.startsWith('en')) || null;
}

export async function fetchPronunciationUrl(word: string, signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`, { signal });
  if (!response.ok) return null;
  const data = await response.json() as DictionaryEntry[];
  const phonetics = data[0]?.phonetics || [];
  return phonetics.find(item => item.audio?.includes('-us.mp3'))?.audio
    || phonetics.find(item => item.audio)?.audio
    || null;
}
