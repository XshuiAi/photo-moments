const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const travel=JSON.parse(fs.readFileSync(__dirname+'/travel-gallery.json'));
const old=JSON.parse(fs.readFileSync(__dirname+'/gallery.json'));
const drama=JSON.parse(fs.readFileSync(__dirname+'/drama-gallery.json'));
assert.equal(travel.length,78);
assert.equal(travel.filter(a=>a.kind==='legacy').length,76);
assert.equal(travel.filter(a=>a.replacement).length,2);
assert(!travel.some(a=>['红伞','红衣旅人'].includes(a.name)));
assert(travel.some(a=>a.replacement==='art-01')&&travel.some(a=>a.replacement==='art-02'));
travel.filter(a=>a.kind==='legacy').forEach(a=>assert(a.style && a.name));
assert.equal(drama.length,12);assert.equal(new Set(drama.map(a=>a.hash)).size,12);assert.equal(new Set(drama.map(a=>a.series)).size,4);
assert(drama.some(a=>a.character.includes('容寄侨'))&&drama.some(a=>a.character.includes('李幼薇'))&&drama.some(a=>a.character.includes('场景')));
assert(drama.every(a=>a.sourceURL.startsWith('https://')&&fs.existsSync(__dirname+'/'+a.src)));
function context(state){
 const c={Date,Math,crypto:require('node:crypto').webcrypto,selectedGallery:[],gallery:old,travelGallery:travel,dramaGallery:drama,allAssets:[...old,...travel,...drama],
 today:()=> '2026-09-27',urlFor:()=> 'blob:test',library:[],activeOrbitId:'',album:{},records:[],pendingVideos:[],activeRecord:null,
 returnFocus:null,velocity:[],wheelSum:0,wheelDirection:0,wheelLast:0,
 db:null,openDB:async()=>({}),dbGet:async()=>state,checkpoints:[],announcements:[],saved:[],
 $:()=>({value:'',textContent:''}),rebuild(){},loadMusic(){},seedMusicCatalog:async()=>{},safeOpen(){},fingerprint:async image=>image.hash};
 c.checkpoint=async key=>c.checkpoints.push(key);
 c.announce=message=>c.announcements.push(message);
 c.save=async()=>{c.library=c.captureLibrary(c.library,c.activeOrbitId,{album:c.album,records:c.records,pendingVideos:c.pendingVideos});c.saved.push({activeId:c.activeOrbitId,orbits:c.library.map(c.cloneOrbit)});return true};
 vm.createContext(c);
 vm.runInContext(section('function recordsFromAssets(', '// Read-only diagnostics'),c);
 vm.runInContext(section('async function initialize(){','\ninitialize();'),c);
 return c;
}
(async()=>{
 const personal={id:'user-a',name:'我的照片',demo:false,image:{hash:'same'},hash:'same',note:'出发',date:'2026-09-22',order:0};
 const duplicate={...personal,id:'user-b',note:'回家'};
 const media={file:{name:'my-song.mp3'},name:'my-song.mp3'};
 const state={version:4,album:{title:'我的旅行',owner:'SHERRY小水',days:{'2026-09-22':'开心'},music:media},records:[personal,duplicate,{id:'demo-3',assetId:old[3].id,demo:true,date:'2026-09-22',order:2,note:'旧留言'},{id:'demo-11',assetId:old[11].id,demo:true,date:'2026-09-22',order:3,note:''}],pendingVideos:[{name:'未配对.mov',file:{}}]};
 const c=context(state);await c.initialize();
 assert.equal(c.library.length,2);assert.equal(c.activeOrbitId,'travel');
 assert(c.checkpoints.includes('before-v5-multiple-orbits'));
 assert.equal(c.records.length,3);assert.equal(c.records[0].note,'出发\n回家');
 assert.equal(c.records[1].assetId,'travel-3');assert.equal(c.records[1].note,'旧留言');
 assert.equal(c.records[2].assetId,'travel-11');assert.equal(c.album.music.name,'my-song.mp3');assert.equal(c.pendingVideos.length,1);
 assert.equal(state.records.length,4,'original snapshot is not mutated');
 const other=c.library.find(o=>o.id==='drama');assert.equal(other.records.length,drama.length);assert.equal(other.album.music,null);
 const empty=c.blankOrbit('empty','下一次旅行','travel','我');c.library.push(empty);
 c.activateOrbit(empty);assert.equal(c.records.length,0);c.records.push({...personal,id:'new',note:'另一份'});c.album.days['2026-10-01']='新心情';await c.save();
 assert.equal(c.library.find(o=>o.id==='travel').records[0].note,'出发\n回家');
 assert.equal(c.library.find(o=>o.id==='travel').album.days['2026-10-01'],undefined);
 assert.equal(c.library.find(o=>o.id==='drama').records.length,drama.length);
 const reload=context({version:5,activeId:'empty',orbits:c.library});await reload.initialize();
 assert.equal(reload.activeOrbitId,'empty');assert.equal(reload.records.length,1);assert.equal(reload.records[0].note,'另一份');
 const blankReload=context({version:5,activeId:'blank',orbits:[c.blankOrbit('blank','空球','custom','我')]});await blankReload.initialize();
 assert.equal(blankReload.records.length,0,'empty spheres stay empty after reload');
 const failed=context(state);failed.checkpoint=async()=>{throw Error('quota')};await failed.initialize();assert.equal(failed.saved.length,0,'failed checkpoint never overwrites the existing database');
 const selection=JSON.parse(fs.readFileSync(__dirname+'/selected-gallery.json'));
 assert.equal(selection.length,36);assert.equal(new Set(selection.map(a=>a.hash)).size,36);
 const chosen=context(null);chosen.selectedGallery=selection;chosen.allAssets.push(...selection);
 const dramaWithUser=chosen.blankOrbit('drama','心动漫剧','drama','我');dramaWithUser.records=[...chosen.recordsFromAssets(drama),personal];dramaWithUser.album.music=media;dramaWithUser.album.days={'2026-09-22':'保留'};
 const travelUntouched=chosen.blankOrbit('travel','旅行','travel','我');travelUntouched.records=[personal];
 const updated=chosen.applySelectedGallery([travelUntouched,dramaWithUser]);
 assert.equal(updated[1].records.length,37);assert.equal(updated[1].records[0].note,'出发');assert.equal(updated[1].album.music,media);assert.equal(updated[1].album.days['2026-09-22'],'保留');assert.equal(updated[0],travelUntouched);assert.equal(dramaWithUser.records.length,13);
 assert.equal(chosen.applySelectedGallery(updated)[1].records.length,37,'reload does not reseed');
 console.log('PASS: user selection replaces only old drama samples, preserves uploads/music/days/travel, idempotent.');
 console.log('PASS: original 76 travel crops + 2 anime replacements; v4→v5 backup/migration; duplicate notes; independent photos/music/days; new empty sphere; selected sphere after reload; failed migration does not write.');
})().catch(e=>{console.error(e);process.exitCode=1});
