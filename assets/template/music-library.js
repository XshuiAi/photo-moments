'use strict';
// Pure playlist operations shared by the page and regression tests.
const OrbitMusic = {
  normalize(album) {
    const tracks = Array.isArray(album.playlist) ? album.playlist : album.music ? [album.music] : [];
    const seen = new Set();
    album.playlist = tracks.filter(t => t && t.file).map((t, i) => ({...t, id:t.id || `legacy-${i}`})).filter(t => !seen.has(t.id) && seen.add(t.id));
    album.music = album.playlist.find(t => t.id === album.music?.id) || album.playlist.find(t => t.file === album.music?.file) || album.playlist[0] || null;
    return album.playlist;
  },
  next(tracks, currentId, random, bag, rng = Math.random) {
    if (!tracks.length) return {track:null, bag:[]};
    if (!random) return {track:tracks[(tracks.findIndex(t => t.id === currentId) + 1) % tracks.length], bag:[]};
    let remaining = bag.filter(id => id !== currentId && tracks.some(t => t.id === id));
    if (!remaining.length) {
      remaining = tracks.filter(t => tracks.length === 1 || t.id !== currentId).map(t => t.id);
      for (let i=remaining.length-1; i>0; i--) {const j=Math.floor(rng()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
    }
    const nextId = remaining.pop();
    return {track:tracks.find(t => t.id === nextId), bag:remaining};
  },
  bytes(album) {return (Array.isArray(album.playlist) ? album.playlist : album.music ? [album.music] : []).reduce((n,t)=>n+(t.file?.size||0),0);}
};
if (typeof module !== 'undefined') module.exports = OrbitMusic;
