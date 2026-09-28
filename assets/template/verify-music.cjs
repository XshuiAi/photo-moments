const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./music-library.js');
const legacyFile=new File(['old song'],'old.mp3',{type:'audio/mpeg'});
const album={music:{name:'旧歌',file:legacyFile}};M.normalize(album);
assert.equal(album.playlist.length,1);assert.equal(album.music.file,legacyFile);
M.normalize(album);assert.equal(album.playlist.length,1,'legacy migration is idempotent');
const tracks=Array.from({length:6},(_,i)=>({id:String(i),file:new File(['sound'],'track.m4a',{type:'audio/mp4'})}));
let bag=[],current='0',played=[];
for(let i=0;i<5;i++){const next=M.next(tracks,current,true,bag,()=>.3);assert.notEqual(next.track.id,current);bag=next.bag;current=next.track.id;played.push(current)}
assert.equal(new Set(played).size,5,'all remaining songs play before repetition');
for(let i=0;i<100;i++){const next=M.next(tracks,current,true,bag);assert.notEqual(next.track.id,current);current=next.track.id;bag=next.bag}
assert.equal(M.next([tracks[0]],'0',true,[]).track.id,'0');assert.equal(M.next([],null,true,[]).track,null);
assert.equal(M.next(tracks,'5',false,[]).track.id,'0');assert.equal(M.bytes(album),8);
const catalog=JSON.parse(fs.readFileSync('music-catalog.json'));
assert.equal(catalog.filter(t=>t.theme==='drama').length,8);assert.equal(catalog.filter(t=>t.theme==='travel').length,5);
assert.equal(new Set(catalog.map(t=>t.id)).size,13);
for(const t of catalog){assert(t.duration>=29.9&&(t.id==='two-sides'||t.duration<=60.1));assert(/^assets\/music-20260927\/[a-z0-9-]+\.m4a$/.test(t.src));assert(fs.statSync(t.src).size>10000)}
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('async function seedMusicCatalog(){'),end=source.indexOf('let manageSelection=',start);
const context={window:{ORBIT_MUSIC:catalog},OrbitMusic:M,File,db:{},checkpoint:async()=>{},announce(){},fetch:async()=>({ok:true,blob:async()=>new Blob(['audio'],{type:'audio/mp4'})}),library:[{id:'travel',album:{theme:'travel',music:{name:'旧歌',file:legacyFile}},records:[{note:'出发',image:new Blob(['photo'])}],pendingVideos:[]},{id:'drama',album:{theme:'drama',music:null},records:[],pendingVideos:[]}]};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
(async()=>{await context.seedMusicCatalog();assert.equal(context.library[0].album.playlist.length,6);assert.equal(context.library[0].album.music.file,legacyFile);assert.equal(context.library[1].album.playlist.length,8);assert.equal(context.library[0].records[0].note,'出发');await context.seedMusicCatalog();assert.equal(context.library[0].album.playlist.length,6);
const failed={...context,library:[{id:'drama',album:{theme:'drama'},records:[],pendingVideos:[]}],checkpoint:async()=>{throw Error('quota')}};vm.createContext(failed);vm.runInContext(source.slice(start,end),failed);await assert.rejects(failed.seedMusicCatalog());assert.equal(failed.library[0].album.playlist,undefined);
const backupContext={File,atob,dataURL:async blob=>'data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64')};vm.createContext(backupContext);
vm.runInContext(source.slice(source.indexOf('async function packMusicTracks('),source.indexOf('async function exportBackup(')),backupContext);
vm.runInContext(source.slice(source.indexOf('async function restoreBlob('),source.indexOf("$('#backup-file').addEventListener")),backupContext);
const packed=await backupContext.packMusicTracks([{id:'test',name:'测试',file:legacyFile,duration:30}]);const restored=await backupContext.unpackMusicTracks({version:6,playlist:packed});assert.equal(await restored[0].file.text(),'old song');assert.equal(restored[0].name,'测试');assert.equal(restored[0].duration,30);
const oldBackup=await backupContext.unpackMusicTracks({version:5,music:{name:'旧歌',data:packed[0].data}});assert.equal(await oldBackup[0].file.text(),'old song');
await assert.rejects(backupContext.unpackMusicTracks({version:6,playlist:[{name:'bad',data:'https://example.com/private'}]}));
await assert.rejects(backupContext.unpackMusicTracks({version:6,playlist:[...packed,...packed]}));
await assert.rejects(backupContext.unpackMusicTracks({version:6,playlist:Array(61).fill(packed[0])}));
const change={...context,library:[{id:'drama',album:{theme:'drama',music:{id:'villain-march',file:legacyFile},playlist:[{id:'villain-march',file:legacyFile},{id:'amazon',file:legacyFile},{id:'personal',file:legacyFile,name:'我的上传'}]},records:[],pendingVideos:[]}]};vm.createContext(change);vm.runInContext(source.slice(start,end),change);await change.seedMusicCatalog();assert(!change.library[0].album.playlist.some(t=>t.id==='villain-march'));assert(change.library[0].album.playlist.some(t=>t.id==='personal'));assert(!change.library[0].album.playlist.some(t=>t.id==='amazon'));assert.notEqual(change.library[0].album.music?.id,'amazon');assert.notEqual(change.library[0].album.music?.id,'villain-march');
console.log('PASS: playlist backup round-trip, legacy backup, invalid URL, duplicate IDs and excess tracks rejected.');
console.log('PASS: 13 valid tracks; legacy music preserved; theme isolation; idempotent seed; backup failure stops import; shuffle cycles without consecutive repetition; empty/single/sequential playlists.');
})().catch(e=>{console.error(e);process.exitCode=1});
