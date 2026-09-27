const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');const c={};vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('function removePhotos('),source.indexOf('function renderManage(')),c);
vm.runInContext(source.slice(source.indexOf('function adjacentIndex('),source.indexOf('async function turnPhoto(')),c);
const media={size:123},items=[{id:'a',order:0,note:'保留心情',video:media},{id:'b',order:1},{id:'c',order:2}],before=JSON.stringify(items);
let single=c.removePhotos(items,['a']);assert.deepEqual(Array.from(single.records,r=>r.id),['b','c']);assert.equal(single.count,1);assert(!('trash' in single));
let result=c.removePhotos(items,['a','c']);assert.deepEqual(Array.from(result.records,r=>r.id),['b']);assert.equal(result.count,2);assert.equal(JSON.stringify(items),before);
let again=c.removePhotos(result.records,['a']);assert.equal(again.count,0);assert.equal(again.records.length,1);
assert.equal(c.removePhotos(items,['a','b','c']).records.length,0);
assert(!source.includes('recoverPhotos'));assert(!source.includes('before-last-photo-delete'));
assert.equal(c.adjacentIndex(0,-1,36),35);assert.equal(c.adjacentIndex(35,1,36),0);assert.equal(c.adjacentIndex(0,1,0),-1);
const html=fs.readFileSync('index.html','utf8');assert(!html.includes('id="settings"'));assert(!html.includes('最近删除'));assert(!html.includes('manage-trash-tab'));assert(html.includes('id="music-list"'));assert(html.includes('id="photo-prev"')&&html.includes('id="photo-next"'));assert(!source.includes('· ${current.name}'));
const assets=JSON.parse(fs.readFileSync('selected-gallery.json'));assert.equal(assets.length,36);const added=assets.filter(a=>a.crop);assert.equal(added.length,7);for(const a of added){assert(a.height===a.crop.bottom-a.crop.top);assert(a.crop.bottom<a.crop.originalHeight);assert(fs.existsSync(a.src))}
console.log('PASS: single/batch direct deletion; no trash/recovery UI or delete snapshot; idempotent; viewer wrap-around; seven cropped views; settings/name/music UI structure.');
