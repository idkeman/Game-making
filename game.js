const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);

let W=0,H=0,dpr=1,last=0,running=false,paused=false;
let level=1,xp=0,xpNeed=10,kills=0,timeLeft=600,hp=100,maxHp=100,score=0,hits=0,maxHits=3;
let auraRadius=0,auraTimer=0,auraPulse=0;
let spawnTimer=0,shootTimer=0,dashTimer=0,enemyId=0,shake=0,pendingLevels=0;
let cameraX=0,cameraY=0;
let mouseX=0,mouseY=0,mouseDown=false,runTime=0,gunKick=0;
let boss=null,bossesDefeated=0,nextBossTime=480,bossWarningTimer=0,toastTimer=0,multiplayerMode=false;
let dying=false,deathTimer=0,deathDuration=3.2,deathSeed=0;

const keys=new Set();
const enemies=[];
const bullets=[];
const enemyBullets=[];
const gems=[];
const particles=[];
const rings=[];

const player={
  x:0,y:0,r:14,
  speed:220,
  damage:18,
  rate:.46,
  range:410,
  shots:1,
  spread:.15,
  magnet:75,
  regen:0,
  armor:0,
  crit:0,
  pierce:0,
  bulletSize:1,
  dashPower:170,
  dashCd:2.4,
  invuln:0
};

const upgrades=[
 {icon:"✦",name:"Moonlit Edge",desc:"+7 weapon damage",apply:()=>player.damage+=7},
 {icon:"◈",name:"Quick Hands",desc:"Fire 18% faster",apply:()=>player.rate=Math.max(.12,player.rate*.82)},
 {icon:"✧",name:"Split Shot",desc:"+1 projectile per volley",apply:()=>player.shots++},
 {icon:"◇",name:"Fleetfoot",desc:"+12% movement speed",apply:()=>player.speed*=1.12},
 {icon:"◎",name:"Second Wind",desc:"Recover one spent hit",apply:()=>{hits=Math.max(0,hits-1)}},
 {icon:"⊙",name:"Long Sight",desc:"+80 attack range",apply:()=>player.range+=80},
 {icon:"❖",name:"Essence Magnet",desc:"+55 pickup radius",apply:()=>player.magnet+=55},
 {icon:"†",name:"Iron Will",desc:"Recover one spent hit",apply:()=>{hits=Math.max(0,hits-1)}},
 {icon:"✹",name:"Piercing Star",desc:"Projectiles pierce +1 enemy",apply:()=>player.pierce++},
 {icon:"☄",name:"Critical Night",desc:"+8% critical strike chance",apply:()=>player.crit+=.08},
 {icon:"⌁",name:"Dash Core",desc:"Dash cooldown reduced by 20%",apply:()=>player.dashCd=Math.max(.55,player.dashCd*.8)},
 {icon:"✺",name:"Heavy Rounds",desc:"+25% projectile size and +2 damage",apply:()=>{player.bulletSize*=1.25;player.damage+=2}},
 {icon:"♥",name:"Sanguine Pact",desc:"Heal 8% of max health",apply:()=>hp=Math.min(maxHp,hp+maxHp*.08)},
 {icon:"☀",name:"Solar Core",desc:"+12% projectile speed and +15 range",apply:()=>{player.projectileSpeed=(player.projectileSpeed||650)*1.12;player.range+=15}},
 {icon:"◉",name:"Blood Radius",desc:"Create a damaging aura that deals 25% of enemy max health. +35 radius per upgrade.",apply:()=>{auraRadius=Math.min(260,auraRadius+70);auraTimer=0}},
 {icon:"⚔",name:"Executioner",desc:"+15% damage against enemies below 40% HP",apply:()=>player.execute=(player.execute||0)+.15}
];

const enemyTypes=[
 {name:"Wisp",r:10,hp:24,speed:58,damage:8,color:"#713743",xp:3},
 {name:"Stalker",r:14,hp:48,speed:46,damage:12,color:"#8f4337",xp:5},
 {name:"Swift",r:8,hp:16,speed:88,damage:7,color:"#633a35",xp:2},
 {name:"Brute",r:22,hp:120,speed:30,damage:19,color:"#8d5437",xp:12},
 {name:"Ghoul",r:12,hp:30,speed:70,damage:9,color:"#765044",xp:3},
 {name:"Leaper",r:11,hp:34,speed:54,damage:14,color:"#8a4d38",xp:4},
 {name:"Spitter",r:13,hp:42,speed:38,damage:10,color:"#6f4b38",xp:5},
 {name:"Crawler",r:9,hp:20,speed:102,damage:8,color:"#6d3d35",xp:2},
 {name:"Bomber",r:12,hp:38,speed:64,damage:24,color:"#9b4935",xp:6}
];



const META_KEY="nightfall_meta_v1";
const characters=[
  {id:"warden",name:"THE WARDEN",weapon:"Carbine",weaponKind:"rifle",icon:"▰",maxHits:3,speed:220,damage:18,rate:.46,range:410,shots:1,spread:.15,projectileSpeed:650,pierce:0,bulletSize:1,desc:"Reliable all-rounder. No gimmick, no weakness.",gimmick:"Balanced",color:"#d9c2a5",unlockTime:0,unlockEssence:0,cost:0},
  {id:"ironclad",name:"IRONCLAD",weapon:"Scatter Cannon",weaponKind:"shotgun",icon:"◆",maxHits:5,speed:180,damage:13,rate:.78,range:330,shots:5,spread:.27,projectileSpeed:500,pierce:0,bulletSize:1.05,desc:"A walking bunker with a brutal close-range cannon.",gimmick:"Armor absorbs one hit every 8s. Slow.",color:"#b99d82",unlockTime:90,unlockEssence:100,cost:75},
  {id:"gunslinger",name:"GUNSLINGER",weapon:"Twin Pistols",weaponKind:"twin",icon:"Ⅱ",maxHits:2,speed:245,damage:11,rate:.24,range:450,shots:2,spread:.09,projectileSpeed:780,pierce:0,bulletSize:.8,desc:"Two pistols, absurd fire rate, almost no room for mistakes.",gimmick:"Every 8 shots trims dash cooldown. Only 2 hits.",color:"#d47b58",unlockTime:180,unlockEssence:220,cost:150},
  {id:"reaper",name:"THE REAPER",weapon:"Soul Scythe",weaponKind:"scythe",icon:"☾",maxHits:3,speed:190,damage:38,rate:.76,range:540,shots:1,spread:0,projectileSpeed:470,pierce:4,bulletSize:2.1,desc:"Launches enormous soul blades that tear through crowds.",gimmick:"18% chance to recover a hit on kill. Very slow fire.",color:"#a56d5b",unlockTime:240,unlockEssence:350,cost:200},
  {id:"hexer",name:"THE HEXER",weapon:"Hex Orb",weaponKind:"hex",icon:"◉",maxHits:3,speed:200,damage:24,rate:.58,range:470,shots:1,spread:0,projectileSpeed:360,pierce:0,bulletSize:1.4,desc:"Slow cursed orbs detonate around anything they strike.",gimmick:"Impact explosions hit nearby enemies. Slow shots.",color:"#9f6b55",unlockTime:300,unlockEssence:500,cost:275},
  {id:"hellbringer",name:"HELLBRINGER",weapon:"Hellfire Hose",weaponKind:"flame",icon:"♨",maxHits:4,speed:205,damage:8,rate:.08,range:240,shots:1,spread:.22,projectileSpeed:520,pierce:0,bulletSize:1.6,desc:"A short-range stream of fire that melts anything nearby.",gimmick:"Extreme fire rate and close range. Builds heat.",color:"#df7548",unlockTime:360,unlockEssence:700,cost:350},
  {id:"huntress",name:"THE HUNTRESS",weapon:"Nailbow",weaponKind:"nail",icon:"➶",maxHits:3,speed:260,damage:28,rate:.36,range:650,shots:1,spread:.015,projectileSpeed:920,pierce:2,bulletSize:.75,desc:"Fast, precise, and built to punch through lines of enemies.",gimmick:"Every 6th shot becomes an empowered piercing shot.",color:"#c89568",unlockTime:450,unlockEssence:950,cost:450},
  {id:"revenant",name:"THE REVENANT",weapon:"Blood Cannon",weaponKind:"blood",icon:"●",maxHits:2,speed:185,damage:40,rate:.62,range:500,shots:1,spread:0,projectileSpeed:430,pierce:1,bulletSize:2,desc:"Slow, dangerous, and almost impossible to keep down.",gimmick:"Kills have a chance to restore a lost hit. Only 2 hits.",color:"#b84f48",unlockTime:540,unlockEssence:1250,cost:550},
  {id:"stormcaller",name:"STORMCALLER",weapon:"Arc Rifle",weaponKind:"arc",icon:"ϟ",maxHits:3,speed:225,damage:20,rate:.50,range:500,shots:1,spread:.02,projectileSpeed:720,pierce:0,bulletSize:1,desc:"A crackling rifle whose shots leap from target to target.",gimmick:"Hits chain to up to 2 nearby enemies. Lower direct damage.",color:"#c77a58",unlockTime:600,unlockEssence:1600,cost:700}
];

let selectedCharacterId="warden";
let activeCharacter=characters[0];
let meta={essence:0,totalEssence:0,playTime:0,unlocked:["warden"]};
let metaSaveTimer=0;
try{
  const saved=JSON.parse(localStorage.getItem(META_KEY)||"null");
  if(saved&&typeof saved==="object"){
    meta={...meta,...saved};
    meta.essence=Math.max(0,Number(meta.essence)||0);
    meta.totalEssence=Math.max(meta.essence,Number(meta.totalEssence)||0);
    meta.playTime=Math.max(0,Number(meta.playTime)||0);
    meta.unlocked=Array.isArray(meta.unlocked)?meta.unlocked.filter(id=>characters.some(c=>c.id===id)):["warden"];
  }
}catch{}
if(!meta.unlocked.includes("warden"))meta.unlocked.unshift("warden");

function saveMeta(){
  try{localStorage.setItem(META_KEY,JSON.stringify(meta))}catch{}
}
function formatMetaTime(seconds){
  const total=Math.floor(Math.max(0,seconds));
  return Math.floor(total/60)+":"+String(total%60).padStart(2,"0");
}
function characterEligible(c){
  return c.id==="warden"||meta.unlocked.includes(c.id)||meta.playTime>=c.unlockTime||meta.totalEssence>=c.unlockEssence;
}
function isCharacterOwned(c){return c.id==="warden"||meta.unlocked.includes(c.id)}
function unlockCharacter(c){
  if(!characterEligible(c))return false;
  if(isCharacterOwned(c))return true;
  if(meta.essence<c.cost)return false;
  meta.essence-=c.cost;
  meta.unlocked.push(c.id);
  saveMeta();
  renderCharacterSelect();
  showToast(c.name+" UNLOCKED");
  return true;
}
function chooseCharacter(id){
  const c=characters.find(x=>x.id===id);
  if(!c||!isCharacterOwned(c))return;
  selectedCharacterId=id;
  activeCharacter=c;
  updateCharacterSummary();
  renderCharacterSelect();
}
function updateCharacterSummary(){
  const c=characters.find(x=>x.id===selectedCharacterId)||characters[0];
  activeCharacter=c;
  const nameEl=$("selected-character-name"),weaponEl=$("selected-character-weapon"),wallet=$("meta-essence"),progress=$("meta-progress"),summary=$("meta-summary");
  if(nameEl)nameEl.textContent=c.name;
  if(weaponEl)weaponEl.textContent=c.weapon.toUpperCase()+" · "+c.maxHits+" HITS";
  if(wallet)wallet.textContent=Math.floor(meta.essence).toLocaleString();
  if(progress)progress.textContent="SURVIVED "+formatMetaTime(meta.playTime);
  if(summary)summary.textContent="ESSENCE "+Math.floor(meta.essence).toLocaleString()+" · LIFETIME "+formatMetaTime(meta.playTime);
}
function openCharacterSelect(){
  renderCharacterSelect();
  $("start").classList.add("hidden");
  $("character-select").classList.remove("hidden");
}
function closeCharacterSelect(){
  $("character-select").classList.add("hidden");
  $("start").classList.remove("hidden");
  updateCharacterSummary();
}
function renderCharacterSelect(){
  updateCharacterSummary();
  const grid=$("character-grid"),status=$("character-status"),confirm=$("character-confirm");
  if(!grid)return;
  grid.innerHTML="";
  for(const c of characters){
    const owned=isCharacterOwned(c),eligible=characterEligible(c),selected=c.id===selectedCharacterId;
    const card=document.createElement("article");
    card.className="character-card"+(selected?" selected ":"")+(owned?"":" locked")+(eligible?"":" unavailable");
    const req=eligible?"UNLOCK READY":"PLAY "+formatMetaTime(c.unlockTime)+" OR EARN "+c.unlockEssence+" ESSENCE";
    const action=document.createElement("button");
    action.className="char-action"+(owned?"":" secondary");
    action.type="button";
    action.textContent=owned?(selected?"SELECTED":"SELECT"):eligible?("BUY · "+c.cost+" ESSENCE"):"LOCKED";
    action.disabled=!owned&&!eligible;
    action.onclick=e=>{
      e.stopPropagation();
      if(owned)chooseCharacter(c.id);
      else if(eligible)unlockCharacter(c);
    };
    card.onclick=()=>{if(owned)chooseCharacter(c.id)};
    card.innerHTML='<div class="char-top"><div class="char-icon">'+c.icon+'</div><div><strong>'+c.name+'</strong><span>'+c.weapon.toUpperCase()+'</span></div></div>'+
      '<div class="char-desc">'+c.desc+'</div>'+
      '<div class="char-stats"><div class="char-stat"><span>HP</span><b>'+c.maxHits+' HITS</b></div><div class="char-stat"><span>SPEED</span><b>'+Math.round(c.speed)+'</b></div><div class="char-stat"><span>DAMAGE</span><b>'+Math.round(c.damage)+'</b></div><div class="char-stat"><span>GIMMICK</span><b>'+c.gimmick+'</b></div></div>';
    if(!owned)card.insertAdjacentHTML("beforeend",'<div class="lock-note">'+req+(eligible?" · PURCHASE REQUIRED":"")+'</div>');
    card.appendChild(action);
    grid.appendChild(card);
  }
  const current=characters.find(c=>c.id===selectedCharacterId)||characters[0];
  if(status)status.textContent=current.name+" · "+current.weapon+" · "+current.maxHits+" HITS";
  if(confirm)confirm.disabled=!isCharacterOwned(current);
}
function applyCharacter(){
  const c=characters.find(x=>x.id===selectedCharacterId)||characters[0];
  activeCharacter=c;
  maxHits=c.maxHits;
  Object.assign(player,{
    speed:c.speed,damage:c.damage,rate:c.rate,range:c.range,shots:c.shots,spread:c.spread,
    projectileSpeed:c.projectileSpeed,pierce:c.pierce,bulletSize:c.bulletSize,weapon:c.weaponKind,
    weaponName:c.weapon,color:c.color,gimmick:c.id,gimmickCooldown:0,shotCount:0,heat:0,overheated:0,
    dashPower:c.id==="ironclad"?145:170,dashCd:c.id==="gunslinger"?2.1:2.4,
    magnet:75,regen:0,armor:0,crit:0,execute:0,_regen:0
  });
}

const bossTypes=[
 {name:"THE DREAD MOON",r:44,hp:1800,speed:27,damage:30,color:"#b94f61",xp:90,interval:1.8},
 {name:"THE STARVED KING",r:52,hp:3200,speed:22,damage:38,color:"#d07852",xp:140,interval:1.55}
];

function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,canvas.clientWidth);
  H=Math.max(1,canvas.clientHeight);
  canvas.width=Math.floor(W*dpr);
  canvas.height=Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize);
resize();

addEventListener("keydown",e=>{
  const key=e.key.toLowerCase();
  keys.add(key);
  if([" ","shift","arrowup","arrowdown","arrowleft","arrowright"].includes(key))e.preventDefault();
  if(key==="p"&&running&&!isUpgradeOpen())togglePause();
  if(e.code==="ShiftLeft"||e.code==="ShiftRight"){if(running&&!paused&&!isUpgradeOpen())tryDash();}
  if(key==="f"&&running&&!paused&&!isUpgradeOpen())toggleAutoAim();
});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));

function updateAim(e){
  const rect=canvas.getBoundingClientRect();
  mouseX=(e.clientX-rect.left)*(W/rect.width);
  mouseY=(e.clientY-rect.top)*(H/rect.height);
}
canvas.addEventListener("pointermove",updateAim);
canvas.addEventListener("pointerdown",e=>{
  if(e.button===0){
    mouseDown=true;
    canvas.setPointerCapture?.(e.pointerId);
    updateAim(e);
    fire();
  }
});
canvas.addEventListener("pointerup",e=>{if(e.button===0)mouseDown=false;});
canvas.addEventListener("pointercancel",()=>{mouseDown=false;});
canvas.addEventListener("pointerleave",()=>{mouseDown=false;});
addEventListener("blur",()=>{mouseDown=false;keys.clear();});

$("start-btn").addEventListener("click",()=>start(false));
$("character-btn").addEventListener("click",openCharacterSelect);
$("character-back").addEventListener("click",closeCharacterSelect);
$("character-confirm").addEventListener("click",closeCharacterSelect);
$("dismiss-keybinds").addEventListener("click",dismissKeybinds);
updateCharacterSummary();
renderCharacterSelect();
$("host-btn").addEventListener("click",async()=>{
  await window.NightfallMP.host();
});
$("join-btn").addEventListener("click",async()=>{
  await window.NightfallMP.join($("join-code").value);
});
$("resume-btn").addEventListener("click",()=>togglePause());
$("quit-btn").onclick=()=>end(false);
$("again-btn").addEventListener("click",()=>start(false));

function isUpgradeOpen(){return !$("upgrade").classList.contains("hidden")}

function resetWorld(){
  enemies.length=0;
  bullets.length=0;
  enemyBullets.length=0;
  gems.length=0;
  particles.length=0;
  rings.length=0;
  boss=null;
}

function start(isMultiplayer=false){
  dying=false;deathTimer=0;deathSeed=0;
  level=1;xp=0;xpNeed=10;kills=0;timeLeft=600;hits=0;score=0;multiplayerMode=isMultiplayer;
  spawnTimer=0;shootTimer=0;dashTimer=0;enemyId=0;shake=0;pendingLevels=0;runTime=0;gunKick=0;
  bossesDefeated=0;nextBossTime=480;bossWarningTimer=0;toastTimer=0;
  auraRadius=0;auraTimer=0;auraPulse=0;
  Object.assign(player,{
    x:0,y:0,r:14,speed:220,damage:18,rate:.46,range:410,shots:1,
    spread:.15,magnet:75,regen:0,armor:0,crit:0,pierce:0,bulletSize:1,
    dashPower:170,dashCd:2.4,invuln:0,projectileSpeed:650,execute:0,_regen:0,
    weapon:"rifle",weaponName:"Carbine",color:"#d9c2a5",gimmick:"warden",gimmickCooldown:0,shotCount:0,heat:0,overheated:0
  });
  maxHits=3;
  applyCharacter();
  resetWorld();
  running=true;paused=true;keys.clear();
  cameraX=player.x;
  cameraY=player.y;
  mouseX=W/2+100;
  mouseY=H/2;
  mouseDown=false;
  if(multiplayerMode){
    $("mp-status").textContent=window.NightfallMP.isHost?"HOST CO-OP · waiting for players":"CO-OP · connected";
  }else{
    $("mp-status").textContent="Solo mode · multiplayer is optional";
  }
  $("start").classList.add("hidden");
  $("end").classList.add("hidden");
  $("start-coop-btn").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("keybinds").classList.remove("hidden");
  $("upgrade").classList.add("hidden");
  hideBossBar();
  ui();
  last=performance.now();
  requestAnimationFrame(loop);
}

let autoAim=false;
function toggleAutoAim(){
  autoAim=!autoAim;
  showToast(autoAim?"AUTO-AIM ENABLED · F":"AUTO-AIM DISABLED · F");
}
function dismissKeybinds(){
  $("keybinds").classList.add("hidden");
  if(running&&paused){
    paused=false;
    last=performance.now();
    requestAnimationFrame(loop);
  }
}
function togglePause(){
  if(!running||isUpgradeOpen())return;
  paused=!paused;
  $("pause").classList.toggle("hidden",!paused);
  if(!paused){
    last=performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(now){
  if(!running||paused)return;
  const dt=Math.min((now-last)/1000,.033);
  last=now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  meta.playTime+=dt;
  metaSaveTimer+=dt;
  if(metaSaveTimer>=5){metaSaveTimer=0;saveMeta();updateCharacterSummary()}
  if(dying){
    updateDeath(dt);
    return;
  }
  timeLeft-=dt;
  if(timeLeft<=0){
    timeLeft=0;
    ui();
    end(true);
    return;
  }

  shake=Math.max(0,shake-dt*24);
  player.invuln=Math.max(0,player.invuln-dt);
  spawnTimer+=dt;
  shootTimer-=dt;
  runTime+=dt;
  gunKick=Math.max(0,gunKick-dt*8);
  dashTimer=Math.max(0,dashTimer-dt);
  if(player.gimmickCooldown>0)player.gimmickCooldown=Math.max(0,player.gimmickCooldown-dt);
  if(player.weapon==="flame"){
    player.heat=Math.max(0,player.heat-dt*.72);
    if(player.overheated&&player.heat<=.18)player.overheated=0;
  }
  bossWarningTimer=Math.max(0,bossWarningTimer-dt);
  toastTimer=Math.max(0,toastTimer-dt);

  move(dt);
  cameraX=player.x;
  cameraY=player.y;

  if(auraRadius>0){
    auraTimer-=dt;
    auraPulse=Math.max(0,auraPulse-dt*4);
    if(auraTimer<=0){
      auraTimer=.75;
      auraPulse=1;
      damageAura();
    }
  }

  if(!boss&&timeLeft<=nextBossTime){
    spawnBoss();
  }

  if(spawnTimer>=spawnInterval()){
    spawnTimer=0;
    const count=timeLeft<120?2:1;
    for(let i=0;i<count;i++)spawnEnemy();
  }

  const shootHeld=mouseDown||keys.has(" ");
  if(shootHeld&&shootTimer<=0){
    const target=autoAim?nearestTarget():null;
    if(!autoAim||target){
      shootTimer=player.rate;
      fire(target);
    }
  }

  updateBullets(dt);
  updateEnemyBullets(dt);
  updateEnemies(dt);
  if(!running)return;

  updateBoss(dt);
  if(!running)return;

  updateGems(dt);
  updateParticles(dt);
  updateRings(dt);
  updateRegen(dt);
  if(multiplayerMode)window.NightfallMP.tick(dt);
  ui();
}

function damageAura(){
  const targets=boss?[boss,...enemies]:enemies;
  for(const e of [...targets]){
    if(!e||e.dead)continue;
    if(Math.hypot(e.x-player.x,e.y-player.y)<=auraRadius+e.r){
      const damage=e.max*.25;
      e.hp-=damage;
      e.flash=.15;
      burst(e.x,e.y,4,"aura");
      if(e.hp<=0)killEnemy(e);
    }
  }
  if(boss&&boss.hp<=0)defeatBoss();
}

function spawnInterval(){
  const elapsed=600-timeLeft;
  return Math.max(.16,.72-elapsed/1100);
}

function difficulty(){
  const elapsed=600-timeLeft;
  return 1+elapsed/360;
}

function move(dt){
  let x=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0);
  let y=(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0);
  const n=Math.hypot(x,y)||1;
  if(x||y){
    player.x+=x/n*player.speed*dt;
    player.y+=y/n*player.speed*dt;
  }

}

function tryDash(){
  if(dashTimer>0)return;
  let x=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0);
  let y=(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0);
  if(!x&&!y)y=-1;
  const n=Math.hypot(x,y)||1;
  player.x+=x/n*player.dashPower;
  player.y+=y/n*player.dashPower;
  dashTimer=player.dashCd;
  player.invuln=.28;
  burst(player.x,player.y,22,"dash");
  addRing(player.x,player.y,8,55,"dash");
  shake=3;
}

function nearestTarget(){
  let best=null,bd=Infinity;
  const candidates=boss?[boss,...enemies]:enemies;
  for(const e of candidates){
    if(!e||e.dead)continue;
    const d=Math.hypot(e.x-player.x,e.y-player.y);
    if(d<bd&&d<player.range){bd=d;best=e}
  }
  return best;
}

function fire(autoTarget=null){
  if(player.weapon==="flame"&&player.overheated)return;
  const targetX=autoTarget?autoTarget.x:cameraX-W/2+mouseX;
  const targetY=autoTarget?autoTarget.y:cameraY-H/2+mouseY;
  const dx=targetX-player.x;
  const dy=targetY-player.y;
  if(Math.hypot(dx,dy)<1)return;

  const base=Math.atan2(dy,dx);
  const speed=player.projectileSpeed||650;
  gunKick=1;
  player.shotCount=(player.shotCount||0)+1;
  burst(player.x,player.y,2,"muzzle");

  const makeBullet=(angle,opts={})=>{
    bullets.push({
      x:player.x+Math.cos(angle)*24,y:player.y+Math.sin(angle)*24,
      vx:Math.cos(angle)*(opts.speed||speed),vy:Math.sin(angle)*(opts.speed||speed),
      r:opts.r||4,
      damage:opts.damage??player.damage,
      life:opts.life??1.3,
      pierce:opts.pierce??player.pierce,
      hit:new Set(),
      explode:opts.explode||0,
      explodeDamage:opts.explodeDamage||0,
      chain:opts.chain||0,
      chainRange:opts.chainRange||130,
      chainDamage:opts.chainDamage||.55,
      color:opts.color||null,
      empowered:opts.empowered||false
    });
  };

  if(player.weapon==="shotgun"){
    for(let i=0;i<5;i++){
      const a=base+(i-2)*.15+(Math.random()-.5)*.06;
      makeBullet(a,{damage:player.damage*.82,r:4.5,life:.75,speed:player.projectileSpeed});
    }
  }else if(player.weapon==="twin"){
    makeBullet(base-.07,{damage:player.damage,r:3,life:1.1});
    makeBullet(base+.07,{damage:player.damage,r:3,life:1.1});
    if(player.shotCount%8===0)dashTimer=Math.max(0,dashTimer-.22);
  }else if(player.weapon==="scythe"){
    makeBullet(base,{damage:player.damage*2.15,r:10,life:1.05,pierce:player.pierce+4,speed:player.projectileSpeed});
  }else if(player.weapon==="hex"){
    makeBullet(base,{damage:player.damage*1.15,r:7,life:1.8,explode:68,explodeDamage:player.damage*.72,speed:player.projectileSpeed});
  }else if(player.weapon==="flame"){
    const a=base+(Math.random()-.5)*player.spread;
    makeBullet(a,{damage:player.damage*.72,r:5.5,life:.34,speed:player.projectileSpeed});
    player.heat=Math.min(1,player.heat+.055);
    if(player.heat>=1){
      player.overheated=1;
      showToast("HELLFIRE OVERHEATED");
    }
  }else if(player.weapon==="nail"){
    const empowered=player.shotCount%6===0;
    makeBullet(base,{damage:player.damage*(empowered?2.4:1),r:3,life:1.5,pierce:player.pierce+(empowered?3:0),speed:player.projectileSpeed,empowered});
    if(empowered)burst(player.x+Math.cos(base)*25,player.y+Math.sin(base)*25,8,"crit");
  }else if(player.weapon==="blood"){
    makeBullet(base,{damage:player.damage*2.15,r:8,life:1.55,pierce:player.pierce+1,speed:player.projectileSpeed});
  }else if(player.weapon==="arc"){
    makeBullet(base,{damage:player.damage*1.05,r:4.5,life:1.35,speed:player.projectileSpeed,chain:2,chainRange:145,chainDamage:.58,color:"#d17a55"});
  }else{
    for(let i=0;i<player.shots;i++){
      const off=(i-(player.shots-1)/2)*player.spread;
      const a=base+off+(Math.random()-.5)*.025;
      makeBullet(a,{damage:player.damage*(Math.random()<player.crit?2:1),r:4*player.bulletSize,life:1.3,speed:speed});
    }
  }
}

function spawnEnemy(){
  const angle=Math.random()*Math.PI*2;
  const distance=Math.max(W,H)*.65+180+Math.random()*280;
  let x=player.x+Math.cos(angle)*distance;
  let y=player.y+Math.sin(angle)*distance;
  const elapsed=600-timeLeft;
  const available=elapsed<35?4:elapsed<90?6:elapsed<150?8:9;
  const type=enemyTypes[Math.floor(Math.random()*available)];
  const scale=difficulty();
  enemies.push({
    id:enemyId++,x,y,r:type.r,hp:type.hp*scale,max:type.hp*scale,
    speed:type.speed*(1+(600-timeLeft)/1500),damage:type.damage,
    color:type.color,xp:type.xp,flash:0,kind:type.name,
    animSeed:Math.random()*Math.PI*2,attackTimer:1.2+Math.random()*1.8,
    leapTimer:1+Math.random()*2.5,vx:0,vy:0
  });
}

function spawnBoss(){
  const index=bossesDefeated%bossTypes.length;
  const t=bossTypes[index];
  const scale=1+bossesDefeated*.35+(600-timeLeft)/1200;
  const angle=Math.random()*Math.PI*2;
  const distance=Math.max(W,H)*.9+260;
  let x=player.x+Math.cos(angle)*distance;
  let y=player.y+Math.sin(angle)*distance;
  boss={
    id:"boss-"+bossesDefeated,
    name:t.name,
    x,y,r:t.r,
    hp:t.hp*scale,max:t.hp*scale,
    speed:t.speed*(1+bossesDefeated*.08),
    damage:t.damage*(1+bossesDefeated*.08),
    color:t.color,interval:t.interval,attackTimer:1,
    flash:0,dead:false,xp:t.xp
  };
  nextBossTime=Math.max(30,nextBossTime-150);
  bossWarningTimer=4;
  showToast(t.name+" HAS AWAKENED");
  burst(x,y,35,"boss");
  addRing(x,y,20,160,"boss");
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    let remove=b.life<=0||Math.hypot(b.x-player.x,b.y-player.y)>Math.max(W,H)*1.35;

    const targets=boss?[boss,...enemies]:enemies;
    for(const e of targets){
      if(!e||e.dead||remove||b.hit.has(e.id))continue;
      if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
        b.hit.add(e.id);
        let damage=b.damage;
        if(e!==boss&&player.execute&&e.hp/e.max<.4)damage*=1+player.execute;
        e.hp-=damage;
        e.flash=.08;
        burst(b.x,b.y,3,b.empowered?"crit":"hit");

        if(b.explode&&!b.exploded){
          b.exploded=true;
          addRing(e.x,e.y,5,b.explode,"explosion");
          burst(e.x,e.y,16,"explosion");
          for(const other of enemies){
            if(other===e||other.dead)continue;
            const d=Math.hypot(other.x-e.x,other.y-e.y);
            if(d<b.explode){
              other.hp-=b.explodeDamage*(1-d/b.explode);
              other.flash=.12;
              if(other.hp<=0)killEnemy(other);
            }
          }
        }

        if(b.chain&&!b.chained){
          b.chained=true;
          let remaining=b.chain;
          const nearby=enemies
            .filter(other=>!other.dead&&other!==e)
            .map(other=>({other,d:Math.hypot(other.x-e.x,other.y-e.y)}))
            .filter(v=>v.d<b.chainRange)
            .sort((a,c)=>a.d-c.d);
          for(const hit of nearby){
            if(remaining<=0)break;
            const chainDamage=b.damage*b.chainDamage*(1-hit.d/b.chainRange);
            hit.other.hp-=chainDamage;
            hit.other.flash=.1;
            addRing(hit.other.x,hit.other.y,2,18,"chain");
            burst(hit.other.x,hit.other.y,3,"chain");
            if(hit.other.hp<=0)killEnemy(hit.other);
            remaining--;
          }
        }

        if(e.hp<=0){
          if(e===boss)defeatBoss();
          else killEnemy(e);
        }
        if(b.hit.size>b.pierce)remove=true;
      }
    }
    if(remove)bullets.splice(i,1);
  }
}

function updateEnemyBullets(dt){
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b=enemyBullets[i];
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.life<=0||Math.hypot(b.x-player.x,b.y-player.y)>Math.max(W,H)*1.5){
      enemyBullets.splice(i,1);
      continue;
    }
    if(player.invuln<=0&&Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r){
      damagePlayer(b.damage);
      enemyBullets.splice(i,1);
    }
  }
}

function killEnemy(e){
  if(e.dead)return;
  e.dead=true;
  const idx=enemies.indexOf(e);
  if(idx>=0)enemies.splice(idx,1);
  kills++;
  score+=10+Math.floor(e.max);
  gems.push({x:e.x,y:e.y,v:e.xp,r:e.r>18?7:5});
  if((player.gimmick==="reaper"||player.gimmick==="revenant")&&Math.random()<.18&&hits>0){
    hits--;
    burst(e.x,e.y,10,"soul");
    showToast(player.gimmick==="reaper"?"SOUL HARVEST · HIT RESTORED":"BLOOD HARVEST · HIT RESTORED");
  }

  // Every common enemy has its own death signature.
  if(e.kind==="Wisp"){
    burst(e.x,e.y,18,"wispDeath");
    addRing(e.x,e.y,3,42,"wispDeath");
  }else if(e.kind==="Stalker"){
    burst(e.x,e.y,9,"stalkerDeath");
    addRing(e.x,e.y,6,30,"stalkerDeath");
    for(let i=0;i<3;i++)gems.push({x:e.x+(Math.random()-.5)*24,y:e.y+(Math.random()-.5)*24,v:1,r:3});
  }else if(e.kind==="Swift"){
    burst(e.x,e.y,22,"swiftDeath");
    for(let i=0;i<4;i++)addRing(e.x,e.y,2+i*3,12+i*7,"swiftDeath");
  }else if(e.kind==="Brute"){
    burst(e.x,e.y,30,"bruteDeath");
    addRing(e.x,e.y,8,75,"bruteDeath");
    shake=Math.max(shake,8);
  }else if(e.kind==="Ghoul"){
    burst(e.x,e.y,15,"ghoulDeath");
    addRing(e.x,e.y,4,48,"ghoulDeath");
    // Ghouls leave behind a small essence cache.
    for(let i=0;i<2;i++)gems.push({x:e.x+(Math.random()-.5)*18,y:e.y+(Math.random()-.5)*18,v:2,r:4});
  }else if(e.kind==="Leaper"){
    burst(e.x,e.y,24,"leaperDeath");
    addRing(e.x,e.y,3,58,"leaperDeath");
    shake=Math.max(shake,4);
  }else if(e.kind==="Spitter"){
    burst(e.x,e.y,16,"spitterDeath");
    addRing(e.x,e.y,5,52,"spitterDeath");
    for(let i=0;i<5;i++){
      const a=Math.random()*Math.PI*2;
      enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*70,vy:Math.sin(a)*70,r:3,damage:6,life:.8});
    }
  }else if(e.kind==="Crawler"){
    burst(e.x,e.y,28,"crawlerDeath");
    addRing(e.x,e.y,2,35,"crawlerDeath");
  }else if(e.kind==="Bomber"){
    const radius=92;
    burst(e.x,e.y,42,"explosion");
    addRing(e.x,e.y,8,radius,"explosion");
    shake=Math.max(shake,16);
    if(player.invuln<=0&&Math.hypot(player.x-e.x,player.y-e.y)<radius){
      damagePlayer(1);
    }
    for(const other of enemies){
      if(other.dead)continue;
      const d=Math.hypot(other.x-e.x,other.y-e.y);
      if(d<radius){
        other.hp-=55*(1-d/radius);
        other.flash=.15;
        if(other.hp<=0)killEnemy(other);
      }
    }
  }
}

function defeatBoss(){
  if(!boss||boss.dead)return;
  boss.dead=true;
  kills++;
  bossesDefeated++;
  score+=500+Math.floor(boss.max);
  for(let i=0;i<12;i++)gems.push({x:boss.x+(Math.random()-.5)*40,y:boss.y+(Math.random()-.5)*40,v:boss.xp/6,r:7});
  burst(boss.x,boss.y,70,"boss");
  addRing(boss.x,boss.y,10,260,"boss");
  showToast("BOSS DEFEATED");
  boss=null;
  nextBossTime=Math.min(nextBossTime,Math.max(35,timeLeft-1));
}

function damagePlayer(amount){
  if(player.invuln>0||dying)return;
  if(player.gimmick==="ironclad"&&player.gimmickCooldown<=0){
    player.gimmickCooldown=8;
    player.invuln=.45;
    burst(player.x,player.y,18,"armor");
    addRing(player.x,player.y,10,60,"armor");
    showToast("IRONCLAD ARMOR ABSORBED THE HIT");
    return;
  }
  hits++;
  player.invuln=.65;
  shake=10;
  burst(player.x,player.y,16,"damage");
  addRing(player.x,player.y,12,55,"damage");
  if(hits>=maxHits)beginDeath();
}

function beginDeath(){
  if(dying)return;
  dying=true;
  deathTimer=deathDuration;
  deathSeed=Math.random()*1000;
  mouseDown=false;
  keys.clear();
  bullets.length=0;
  enemyBullets.length=0;
  player.invuln=999;
  shake=12;
  burst(player.x,player.y,30,"deathStart");
  addRing(player.x,player.y,8,70,"deathStart");

  // Pull the nearest monsters toward the player so the death becomes a swarm
  // rather than simply freezing the current enemy positions.
  const swarm=enemies
    .filter(e=>!e.dead)
    .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))
    .slice(0,18);
  swarm.forEach((e,i)=>{
    const a=(i/swarm.length)*Math.PI*2+deathSeed*.01;
    const radius=32+(i%4)*15;
    e.deathAngle=a;
    e.deathRadius=radius;
    e.deathTargetX=player.x+Math.cos(a)*radius;
    e.deathTargetY=player.y+Math.sin(a)*radius;
    e.deathSwarm=true;
  });
}

function updateDeath(dt){
  deathTimer-=dt;
  runTime+=dt;
  shake=Math.max(0,shake-dt*16);

  for(const e of enemies){
    if(e.dead)continue;
    if(e.deathSwarm){
      const targetX=e.deathTargetX;
      const targetY=e.deathTargetY;
      const pull=Math.min(1,dt*(deathTimer<1.35?3.5:2.2));
      e.x+=(targetX-e.x)*pull;
      e.y+=(targetY-e.y)*pull;
      e.animSeed=(e.animSeed||0)+dt*2;
    }else{
      // Keep the rest of the horde pressing inward without letting them
      // immediately trigger another hit during the cinematic.
      const a=Math.atan2(player.y-e.y,player.x-e.x);
      const d=Math.hypot(player.x-e.x,player.y-e.y)||1;
      if(d>70){
        e.x+=Math.cos(a)*e.speed*.55*dt;
        e.y+=Math.sin(a)*e.speed*.55*dt;
      }
    }
  }

  if(Math.random()<dt*10){
    const a=Math.random()*Math.PI*2;
    const r=10+Math.random()*65;
    burst(player.x+Math.cos(a)*r,player.y+Math.sin(a)*r,2,"deathDust");
  }

  updateParticles(dt);
  updateRings(dt);
  cameraX=player.x;
  cameraY=player.y;

  if(deathTimer<=0){
    dying=false;
    end(false);
  }
}

function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.dead)continue;
    const dx=player.x-e.x,dy=player.y-e.y;
    const d=Math.hypot(dx,dy)||1;
    const a=Math.atan2(dy,dx);
    e.flash=Math.max(0,e.flash-dt);
    e.animSeed=(e.animSeed||0)+dt;

    if(e.kind==="Ghoul"){
      const side=Math.sin(runTime*7+e.id)*.7;
      const moveA=a+side;
      e.x+=Math.cos(moveA)*e.speed*dt;
      e.y+=Math.sin(moveA)*e.speed*dt;
    }else if(e.kind==="Leaper"){
      e.leapTimer-=dt;
      if(e.leapTimer<=0&&d<430){
        e.leapTimer=2.2+Math.random()*1.3;
        e.vx=Math.cos(a)*250;
        e.vy=Math.sin(a)*250;
        burst(e.x,e.y,5,"dash");
      }
      e.x+=(e.vx+Math.cos(a)*e.speed)*dt;
      e.y+=(e.vy+Math.sin(a)*e.speed)*dt;
      e.vx*=Math.pow(.03,dt);
      e.vy*=Math.pow(.03,dt);
    }else if(e.kind==="Spitter"){
      const desired=230;
      const direction=d<desired?-1:d>desired?1:0;
      e.x+=Math.cos(a)*e.speed*direction*dt;
      e.y+=Math.sin(a)*e.speed*direction*dt;
      e.attackTimer-=dt;
      if(e.attackTimer<=0&&d<430){
        e.attackTimer=2.3+Math.random()*1.2;
        const speed=150;
        enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:4,damage:e.damage,life:4});
        burst(e.x,e.y,4,"hit");
      }
    }else if(e.kind==="Crawler"){
      const wobble=Math.sin(runTime*13+e.animSeed)*.35;
      e.x+=Math.cos(a+wobble)*e.speed*dt;
      e.y+=Math.sin(a+wobble)*e.speed*dt;
    }else{
      e.x+=Math.cos(a)*e.speed*dt;
      e.y+=Math.sin(a)*e.speed*dt;
    }

    if(player.invuln<=0&&d<e.r+player.r){
      damagePlayer(e.damage*dt*3);
      if(!running)return;
    }
  }
}

function updateBoss(dt){
  if(!boss)return;
  boss.flash=Math.max(0,boss.flash-dt);
  const a=Math.atan2(player.y-boss.y,player.x-boss.x);
  const d=Math.hypot(player.x-boss.x,player.y-boss.y);
  const speed=d>170?boss.speed:boss.speed*.25;
  boss.x+=Math.cos(a)*speed*dt;
  boss.y+=Math.sin(a)*speed*dt;

  boss.attackTimer-=dt;
  if(boss.attackTimer<=0){
    boss.attackTimer=boss.interval;
    bossAttack();
  }

  if(player.invuln<=0&&d<boss.r+player.r){
    damagePlayer(boss.damage*dt*2.2);
  }
}

function bossAttack(){
  if(!boss)return;
  const count=10+bossesDefeated*2;
  const base=Math.atan2(player.y-boss.y,player.x-boss.x);
  for(let i=0;i<count;i++){
    const a=base+(i-(count-1)/2)*.16;
    const speed=170+bossesDefeated*25;
    enemyBullets.push({
      x:boss.x,y:boss.y,
      vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      r:5,damage:12+bossesDefeated*4,life:4
    });
  }
  addRing(boss.x,boss.y,boss.r+8,boss.r+38,"bossAttack");
  burst(boss.x,boss.y,12,"boss");
}

function collectXp(value){
  const gained=Math.max(0,Number(value)||0);
  meta.essence+=gained;
  meta.totalEssence+=gained;
  xp+=gained;
  saveMeta();
  updateCharacterSummary();
  while(xp>=xpNeed){
    xp-=xpNeed;
    xpNeed=Math.floor(xpNeed*1.24+4);
    pendingLevels++;
  }
  if(pendingLevels>0&&!isUpgradeOpen())showLevelUp();
}

function updateGems(dt){
  for(let i=gems.length-1;i>=0;i--){
    if(isUpgradeOpen())break;
    const g=gems[i];
    const d=Math.hypot(player.x-g.x,player.y-g.y);

    if(d<player.magnet){
      const pull=Math.min(1,320*dt/Math.max(d,1));
      g.x+=(player.x-g.x)*pull;
      g.y+=(player.y-g.y)*pull;
    }

    if(d<player.r+g.r+5){
      const value=g.v;
      gems.splice(i,1);
      burst(g.x,g.y,3,"xp");
      collectXp(value);
    }
  }
}

function showLevelUp(){
  if(!running||isUpgradeOpen()||pendingLevels<=0)return;
  paused=true;
  const pool=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);
  const box=$("choices");
  box.innerHTML="";

  for(const u of pool){
    const b=document.createElement("button");
    b.className="choice";
    b.type="button";
    b.innerHTML='<div class="icon">'+u.icon+'</div><strong>'+u.name+'</strong><span>'+u.desc+'</span>';
    b.onclick=()=>{
      u.apply();
      pendingLevels--;
      level++;
      $("upgrade").classList.add("hidden");

      if(pendingLevels>0){
        showLevelUp();
      }else{
        paused=false;
        last=performance.now();
        requestAnimationFrame(loop);
      }
    };
    box.appendChild(b);
  }

  $("upgrade").classList.remove("hidden");
}

function burst(x,y,n,type){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2;
    const s=type==="boss"?80+Math.random()*220:30+Math.random()*150;
    particles.push({
      x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:.3+Math.random()*.7,size:1.5+Math.random()*3,type
    });
  }
}

function addRing(x,y,start,end,type){
  rings.push({x,y,r:start,max:end,life:.45,type});
}

function updateRings(dt){
  for(let i=rings.length-1;i>=0;i--){
    const r=rings[i];
    r.r+=(r.max-r.r)*dt*5;
    r.life-=dt;
    if(r.life<=0)rings.splice(i,1);
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.vx*=.965;p.vy*=.965;
    p.life-=dt;
    if(p.life<=0)particles.splice(i,1);
  }
}

function updateRegen(dt){
  if(!player.regen)return;
  player._regen=(player._regen||0)+dt;
  if(player._regen>=5){
    player._regen-=5;
    hp=Math.min(maxHp,hp+player.regen);
  }
}

function showToast(text){
  $("toast").textContent=text;
  $("toast").classList.remove("hidden");
  toastTimer=2.4;
}

function ui(){
  const m=Math.floor(timeLeft/60),s=Math.floor(timeLeft%60);
  $("time").textContent=m+":"+String(s).padStart(2,"0");
  $("level").textContent=level;
  $("kills").textContent=kills;
  $("score").textContent=score.toLocaleString();
  $("xp-fill").style.width=Math.max(0,Math.min(100,xp/xpNeed*100))+"%";
  const lives=$("lives");
  lives.innerHTML="HITS "+Array.from({length:maxHits},(_,i)=>`<span class="hit-pip ${i<hits?"spent":"filled"}"></span>`).join("");

  if(dashTimer<=0){
    $("dash-status").textContent="DASH READY";
    $("dash-status").style.opacity="1";
  }else{
    $("dash-status").textContent="DASH "+dashTimer.toFixed(1)+"s";
    $("dash-status").style.opacity=".55";
  }

  if(boss){
    $("boss-bar").classList.remove("hidden");
    $("boss-name").textContent=boss.name;
    $("boss-hp-text").textContent=Math.max(0,Math.ceil(boss.hp)).toLocaleString()+" / "+Math.ceil(boss.max).toLocaleString();
    $("boss-fill").style.width=Math.max(0,Math.min(100,boss.hp/boss.max*100))+"%";
  }else{
    hideBossBar();
  }

  if(toastTimer<=0)$("toast").classList.add("hidden");
  updateCharacterSummary();
}

function hideBossBar(){
  $("boss-bar").classList.add("hidden");
}

function end(win){
  if(!running)return;
  saveMeta();
  updateCharacterSummary();
  running=false;
  paused=false;
  if(multiplayerMode)window.NightfallMP.leave();
  $("pause").classList.add("hidden");
  $("upgrade").classList.add("hidden");
  $("end").classList.remove("hidden");
  $("end-kicker").textContent=win?"DAWN BREAKS":"THE DARKNESS WON";
  $("end-title").textContent=win?"You survived the night.":"You were swallowed by the night.";
  $("end-stats").textContent="Level "+level+" · "+kills+" enemies defeated · "+bossesDefeated+" bosses defeated · "+score.toLocaleString()+" essence";
}

function draw(){
  ctx.save();
  const sx=(Math.random()-.5)*shake;
  const sy=(Math.random()-.5)*shake;
  ctx.translate(sx,sy);

  ctx.save();
  ctx.translate(W/2-cameraX,H/2-cameraY);
  drawBackground();
  drawRings();
  drawAura();
  for(const g of gems)drawGem(g);
  for(const e of enemies)drawEnemy(e);
  if(boss)drawBoss(boss);
  for(const b of enemyBullets)drawEnemyBullet(b);
  for(const b of bullets)drawBullet(b);
  drawPlayer();
  if(multiplayerMode)window.NightfallMP.drawRemote(ctx);
  drawParticles();
  ctx.restore();

  ctx.restore();
  drawVignette();
}

function worldNoise(x,y){
  const n=Math.sin(x*127.1+y*311.7)*43758.5453123;
  return n-Math.floor(n);
}

function drawBackground(){
  const tile=96;
  const left=Math.floor((cameraX-W/2)/tile)-1;
  const right=Math.ceil((cameraX+W/2)/tile)+1;
  const top=Math.floor((cameraY-H/2)/tile)-1;
  const bottom=Math.ceil((cameraY+H/2)/tile)+1;

  ctx.fillStyle="#050403";
  ctx.fillRect(cameraX-W/2-120,cameraY-H/2-120,W+240,H+240);

  for(let ty=top;ty<=bottom;ty++){
    for(let tx=left;tx<=right;tx++){
      const wx=tx*tile,wy=ty*tile;
      const n=worldNoise(tx,ty);
      const biome=Math.floor(worldNoise(tx*.31,ty*.31)*4);
      const base=["#0b0706","#0d0806","#0c0807","#090806"][biome];
      ctx.fillStyle=base;
      ctx.fillRect(wx,wy,tile+1,tile+1);

      ctx.strokeStyle=n>.55?"#17100d":"#120d0b";
      ctx.lineWidth=1;
      ctx.strokeRect(wx+.5,wy+.5,tile, tile);

      if(n>.72){
        ctx.fillStyle="#1a100c";
        ctx.fillRect(wx+18+n*30,wy+20+(1-n)*35,3,3);
        ctx.fillRect(wx+55+(1-n)*20,wy+62+n*18,2,2);
      }
      if(n<.12){
        ctx.strokeStyle="#21130f";
        ctx.beginPath();
        ctx.moveTo(wx+18,wy+18);ctx.lineTo(wx+38,wy+27);ctx.lineTo(wx+31,wy+44);
        ctx.stroke();
      }
      if(worldNoise(tx+91,ty-47)>.93){
        ctx.fillStyle="#1c110d";
        ctx.beginPath();
        ctx.arc(wx+48,wy+50,8+worldNoise(tx*2,ty*2)*8,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="#2d1a13";
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle="#21130f";
  ctx.lineWidth=1;
  const grid=384;
  const gx0=Math.floor((cameraX-W/2)/grid)*grid;
  const gy0=Math.floor((cameraY-H/2)/grid)*grid;
  for(let x=gx0;x<=cameraX+W/2+grid;x+=grid){
    ctx.beginPath();ctx.moveTo(x,cameraY-H/2-50);ctx.lineTo(x,cameraY+H/2+50);ctx.stroke();
  }
  for(let y=gy0;y<=cameraY+H/2+grid;y+=grid){
    ctx.beginPath();ctx.moveTo(cameraX-W/2-50,y);ctx.lineTo(cameraX+W/2+50,y);ctx.stroke();
  }
}



function getAimPoint(){
  if(autoAim){
    const target=nearestTarget();
    if(target)return {x:target.x,y:target.y};
  }
  return {x:cameraX-W/2+mouseX,y:cameraY-H/2+mouseY};
}

function drawAura(){
  if(auraRadius<=0)return;
  const pulse=1+(auraPulse*.035)+Math.sin(runTime*5)*.018;
  ctx.save();
  ctx.globalAlpha=.10;
  ctx.fillStyle="#b94f35";
  ctx.beginPath();ctx.arc(player.x,player.y,auraRadius*pulse,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.55;
  ctx.strokeStyle="#d46a45";ctx.lineWidth=2;
  ctx.setLineDash([7,9]);
  ctx.beginPath();ctx.arc(player.x,player.y,auraRadius*pulse,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlayer(){
  ctx.save();
  ctx.translate(player.x,player.y);

  if(dying){
    const elapsed=deathDuration-deathTimer;
    const fall=Math.min(1,elapsed/.75);
    const shakeFall=Math.sin(elapsed*34)*fall*1.2;
    ctx.rotate(-1.15*fall+shakeFall*.08);
    ctx.translate(0,fall*8);
    ctx.globalAlpha=Math.max(.35,1-fall*.35);

    ctx.fillStyle="#0009";
    ctx.beginPath();ctx.ellipse(0,12,20,7,0,0,Math.PI*2);ctx.fill();

    ctx.fillStyle="#60493b";
    ctx.beginPath();ctx.roundRect(-10,-4,20,22,7);ctx.fill();
    ctx.fillStyle="#d9c2a5";
    ctx.beginPath();ctx.arc(0,-11,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#261914";
    ctx.beginPath();ctx.roundRect(-6,-14,12,6,3);ctx.fill();
    ctx.fillStyle="#d46a45";
    ctx.fillRect(-4,-13,8,2);

    ctx.strokeStyle="#493329";
    ctx.lineWidth=5;
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(-6,13);ctx.lineTo(-16,19);
    ctx.moveTo(6,13);ctx.lineTo(16,19);
    ctx.stroke();

    ctx.save();
    ctx.rotate(.18);
    ctx.fillStyle="#33251e";
    ctx.fillRect(3,4,28,6);
    ctx.fillStyle="#73503b";
    ctx.fillRect(10,2,14,4);
    ctx.restore();

    ctx.restore();
    drawDeathOverlay();
    return;
  }

  if(player.invuln>0&&Math.floor(player.invuln*30)%2===0)ctx.globalAlpha=.45;
  const aimPoint=getAimPoint();
  const aim=Math.atan2(aimPoint.y-player.y,aimPoint.x-player.x);
  const moving=keys.has("w")||keys.has("a")||keys.has("s")||keys.has("d")||keys.has("arrowup")||keys.has("arrowleft")||keys.has("arrowdown")||keys.has("arrowright");
  const frame=moving?Math.floor(runTime*10)%4:0;
  const steps=[[-2,2],[3,-2],[-2,-2],[3,2]],step=steps[frame];
  const bob=moving?Math.sin(runTime*18)*1.2:0;
  ctx.fillStyle="#0008";ctx.beginPath();ctx.ellipse(0,12,16,7,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=18;ctx.shadowColor=player.color||"#d46a45";ctx.fillStyle=player.color||"#d9c2a5";
  ctx.beginPath();ctx.roundRect(-9,-4+bob,18,23,7);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#60493b";ctx.beginPath();ctx.roundRect(-8,1+bob,16,17,5);ctx.fill();
  ctx.fillStyle="#9a7257";ctx.fillRect(-2,3+bob,4,12);
  ctx.fillStyle="#dfc9ae";ctx.beginPath();ctx.arc(0,-11+bob,8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#261914";ctx.beginPath();ctx.roundRect(-6,-14+bob,12,6,3);ctx.fill();
  ctx.fillStyle="#d46a45";ctx.fillRect(-4,-13+bob,8,2);
  ctx.strokeStyle="#493329";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();
  ctx.moveTo(-5,14+bob);ctx.lineTo(-7+step[0],23+step[1]);ctx.moveTo(5,14+bob);ctx.lineTo(7-step[0],23-step[1]);ctx.stroke();
  ctx.save();
  ctx.rotate(aim);
  ctx.strokeStyle="#c9a985";ctx.lineWidth=5;ctx.beginPath();
  ctx.moveTo(-5,4+bob);ctx.lineTo(5,7+bob);ctx.moveTo(-5,8+bob);ctx.lineTo(5,7+bob);ctx.stroke();

  const kick=gunKick*4;
  ctx.translate(-kick,0);
  ctx.shadowBlur=10;ctx.shadowColor=player.color||"#d46a45";
  ctx.fillStyle="#33251e";

  if(player.weapon==="shotgun"){
    ctx.fillRect(3,2+bob,30,7);ctx.fillRect(3,10+bob,30,4);
    ctx.fillStyle="#73503b";ctx.fillRect(9,0+bob,14,4);
  }else if(player.weapon==="twin"){
    ctx.fillRect(2,1+bob,20,5);ctx.fillRect(2,9+bob,20,5);
    ctx.fillStyle="#73503b";ctx.fillRect(4,-2+bob,10,4);ctx.fillRect(4,13+bob,10,4);
  }else if(player.weapon==="scythe"){
    ctx.strokeStyle="#c99773";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(3,7+bob);ctx.lineTo(30,7+bob);ctx.stroke();
    ctx.strokeStyle="#dfb08b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(31,7+bob,13,-1.8,.8);ctx.stroke();
  }else if(player.weapon==="hex"){
    ctx.fillStyle="#3b211a";ctx.fillRect(4,3+bob,27,8);
    ctx.fillStyle="#c47b59";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(33,7+bob,7,0,Math.PI*2);ctx.fill();
  }else if(player.weapon==="flame"){
    ctx.fillStyle="#47251c";ctx.fillRect(2,3+bob,23,11);
    ctx.fillStyle="#9c543b";ctx.fillRect(20,1+bob,14,5);ctx.fillRect(20,10+bob,14,5);
    ctx.fillStyle="#d96b45";ctx.fillRect(32,5+bob,10,6);
  }else if(player.weapon==="nail"){
    ctx.fillStyle="#3b241d";ctx.fillRect(2,5+bob,34,5);
    ctx.fillStyle="#c7a27d";ctx.fillRect(30,6+bob,16,3);
  }else if(player.weapon==="blood"){
    ctx.fillStyle="#3a1b18";ctx.fillRect(3,3+bob,27,10);
    ctx.fillStyle="#b84f48";ctx.beginPath();ctx.arc(34,8+bob,7,0,Math.PI*2);ctx.fill();
  }else if(player.weapon==="arc"){
    ctx.fillStyle="#32221c";ctx.fillRect(3,3+bob,31,8);
    ctx.strokeStyle="#d47b58";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(31,2+bob);ctx.lineTo(36,7+bob);ctx.lineTo(31,12+bob);ctx.stroke();
  }else{
    ctx.fillRect(3,4+bob,17,6);ctx.fillStyle="#73503b";ctx.fillRect(10,2+bob,14,4);ctx.fillStyle="#1d120d";ctx.fillRect(21,1+bob,16,4);ctx.fillRect(5,10+bob,7,3);
  }

  ctx.fillStyle=player.color||"#e07a4f";ctx.shadowBlur=12;ctx.shadowColor=player.color||"#d46a45";
  ctx.fillRect(player.weapon==="scythe"?31:36,1+bob,3,4);
  if(gunKick>0){
    ctx.fillStyle="#ffd18a";ctx.shadowBlur=18;ctx.shadowColor="#d46a45";
    ctx.beginPath();ctx.moveTo(39,3+bob);ctx.lineTo(49+gunKick*5,bob);ctx.lineTo(46+gunKick*4,4+bob);ctx.lineTo(49+gunKick*5,8+bob);ctx.closePath();ctx.fill();
  }
  ctx.restore();
  ctx.shadowBlur=10;ctx.shadowColor="#b94f35";ctx.strokeStyle="#c26a4c88";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,5,19,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawDeathOverlay(){
  const elapsed=deathDuration-deathTimer;
  const fade=Math.min(1,elapsed/2.4);
  const pulse=.5+.5*Math.sin(elapsed*8);
  ctx.save();
  ctx.fillStyle="rgba(20,4,3,"+(.08+fade*.18)+")";
  ctx.fillRect(cameraX-W/2,cameraY-H/2,W,H);
  ctx.fillStyle="#7e1f18";
  ctx.globalAlpha=.18+fade*.16;
  ctx.beginPath();
  ctx.arc(player.x,player.y,28+pulse*10,0,Math.PI*2);
  ctx.fill();
  ctx.globalAlpha=.9;
  ctx.fillStyle="#e3c2a2";
  ctx.font="900 18px system-ui, sans-serif";
  ctx.textAlign="center";
  ctx.fillText(elapsed<1.0?"OVERWHELMED":"THE HORDE GOT YOU",player.x,player.y-54);
  if(deathTimer<.75){
    ctx.globalAlpha=Math.min(1,(.75-deathTimer)/.75);
    ctx.fillStyle="#050302";
    ctx.fillRect(cameraX-W/2,cameraY-H/2,W,H);
  }
  ctx.restore();
}


// Restored rendering helpers that were accidentally dropped from the death-animation patch.
function drawRings(){
  for(const r of rings){ctx.save();ctx.globalAlpha=Math.max(0,r.life/.45)*.8;ctx.strokeStyle=r.type==="boss"||r.type==="bossAttack"?"#b84b3f":"#b94f35";ctx.lineWidth=r.type==="bossAttack"?3:2;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke();ctx.restore();}
}
function drawGem(g){
  ctx.save();ctx.translate(g.x,g.y);const pulse=1+Math.sin(runTime*7+g.x*.02)*.12;ctx.scale(pulse,pulse);ctx.shadowBlur=14;ctx.shadowColor="#d46a45";ctx.fillStyle="#d46a45";ctx.rotate(Math.PI/4);ctx.fillRect(-g.r*.65,-g.r*.65,g.r*1.3,g.r*1.3);ctx.restore();
}
function drawEnemy(e){
  ctx.save();
  ctx.translate(e.x,e.y);
  ctx.globalAlpha=e.flash>0?.5:1;
  const facing=Math.atan2(player.y-e.y,player.x-e.x);
  ctx.rotate(facing);
  const t=e.animSeed||0;
  const pulse=Math.sin(t*5)*.04;
  ctx.shadowBlur=12;
  ctx.shadowColor=e.color;
  ctx.fillStyle=e.color;

  ctx.save();
  ctx.rotate(-facing);
  ctx.fillStyle="#0009";
  ctx.beginPath();
  ctx.ellipse(0,e.r*.78,e.r*1.05,e.r*.35,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  if(e.kind==="Wisp"){
    const float=Math.sin(t*4)*e.r*.18;
    ctx.translate(0,float);
    ctx.beginPath();
    ctx.moveTo(-e.r*.85,e.r*.15);ctx.quadraticCurveTo(-e.r*.7,-e.r*.9,0,-e.r);
    ctx.quadraticCurveTo(e.r*.7,-e.r*.9,e.r*.85,e.r*.15);
    ctx.lineTo(e.r*.45,e.r*.75);ctx.lineTo(e.r*.12,e.r*.3);
    ctx.lineTo(-e.r*.2,e.r*.8);ctx.lineTo(-e.r*.55,e.r*.5);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle="#f0c19b";
    ctx.beginPath();ctx.arc(-e.r*.3,-e.r*.18,e.r*.16,0,Math.PI*2);ctx.arc(e.r*.3,-e.r*.18,e.r*.16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#35140f";ctx.beginPath();ctx.arc(-e.r*.3,-e.r*.18,e.r*.07,0,Math.PI*2);ctx.arc(e.r*.3,-e.r*.18,e.r*.07,0,Math.PI*2);ctx.fill();

  }else if(e.kind==="Stalker"){
    const sway=Math.sin(t*3)*.08;
    ctx.rotate(sway);
    ctx.beginPath();ctx.ellipse(0,2,e.r*.72,e.r*.98,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(4,e.r*.28);ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(-e.r*.45,-e.r*.05);ctx.lineTo(-e.r*(.9+Math.sin(t*5)*.12),e.r*.65);
    ctx.moveTo(e.r*.45,-e.r*.05);ctx.lineTo(e.r*(.9-Math.sin(t*5)*.12),e.r*.65);ctx.stroke();
    ctx.fillStyle="#d3a17e";ctx.beginPath();ctx.ellipse(0,-e.r*.55,e.r*.53,e.r*.48,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2a120f";ctx.beginPath();ctx.ellipse(-e.r*.2,-e.r*.58,e.r*.11,e.r*.15,0,0,Math.PI*2);ctx.ellipse(e.r*.2,-e.r*.58,e.r*.11,e.r*.15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e06b4b";ctx.beginPath();ctx.arc(-e.r*.2,-e.r*.58,e.r*.045,0,Math.PI*2);ctx.arc(e.r*.2,-e.r*.58,e.r*.045,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#431914";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.r*.25,-e.r*.32);ctx.lineTo(0,-e.r*.2);ctx.lineTo(e.r*.28,-e.r*.32);ctx.stroke();

  }else if(e.kind==="Swift"){
    const bounce=Math.abs(Math.sin(t*12))*e.r*.18;
    ctx.translate(0,-bounce);
    ctx.beginPath();ctx.ellipse(0,0,e.r*1.15,e.r*.7,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(2,e.r*.22);ctx.lineCap="round";
    const leg=Math.sin(t*18)*.45;
    for(let side=-1;side<=1;side+=2){
      ctx.beginPath();ctx.moveTo(side*e.r*.45,-e.r*.25);ctx.lineTo(side*e.r*(1.15+leg),-e.r*.7);ctx.moveTo(side*e.r*.5,e.r*.2);ctx.lineTo(side*e.r*(1.15-leg),e.r*.65);ctx.stroke();
    }
    ctx.fillStyle="#e7b18d";ctx.beginPath();ctx.arc(e.r*.62,-e.r*.15,e.r*.24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2b100d";ctx.beginPath();ctx.arc(e.r*.69,-e.r*.2,e.r*.075,0,Math.PI*2);ctx.fill();

  }else if(e.kind==="Brute"){
    ctx.scale(1+pulse,1-pulse*.5);
    ctx.beginPath();ctx.ellipse(0,2,e.r*.82,e.r*.95,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(7,e.r*.3);ctx.lineCap="round";
    const swing=Math.sin(t*3)*.12;
    ctx.beginPath();ctx.moveTo(-e.r*.58,-e.r*.25);ctx.lineTo(-e.r*(1.08+swing),e.r*.5);ctx.moveTo(e.r*.58,-e.r*.25);ctx.lineTo(e.r*(1.08-swing),e.r*.5);ctx.stroke();
    ctx.fillStyle="#c48c67";ctx.beginPath();ctx.ellipse(0,-e.r*.52,e.r*.58,e.r*.46,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#31120f";ctx.beginPath();ctx.arc(-e.r*.22,-e.r*.56,e.r*.13,0,Math.PI*2);ctx.arc(e.r*.22,-e.r*.56,e.r*.13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e96e48";ctx.beginPath();ctx.arc(-e.r*.22,-e.r*.56,e.r*.055,0,Math.PI*2);ctx.arc(e.r*.22,-e.r*.56,e.r*.055,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#39140f";ctx.beginPath();ctx.moveTo(-e.r*.32,-e.r*.25);ctx.lineTo(0,-e.r*.08);ctx.lineTo(e.r*.32,-e.r*.25);ctx.lineTo(0,e.r*.02);ctx.closePath();ctx.fill();

  }else if(e.kind==="Ghoul"){
    const bob=Math.sin(t*9)*e.r*.14,arm=Math.sin(t*11)*e.r*.18;
    ctx.translate(0,bob);
    ctx.rotate(Math.sin(t*4)*.08);
    ctx.beginPath();ctx.ellipse(0,0,e.r*.68,e.r*.9,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(-e.r*.35,-e.r*.2);ctx.lineTo(-e.r*.9,e.r*.35+arm);ctx.moveTo(e.r*.35,-e.r*.2);ctx.lineTo(e.r*.9,e.r*.35-arm);ctx.stroke();
    ctx.fillStyle="#b98b70";ctx.beginPath();ctx.arc(0,-e.r*.5,e.r*.48,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#26120f";ctx.beginPath();ctx.arc(-e.r*.17,-e.r*.54,e.r*.1,0,Math.PI*2);ctx.arc(e.r*.17,-e.r*.54,e.r*.1,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#4a1b16";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.r*.2,-e.r*.27);ctx.lineTo(0,-e.r*.16);ctx.lineTo(e.r*.2,-e.r*.27);ctx.stroke();

  }else if(e.kind==="Leaper"){
    const crouch=Math.abs(Math.sin(t*4));
    ctx.scale(1+crouch*.12,1-crouch*.16);
    ctx.beginPath();ctx.ellipse(0,e.r*.05,e.r*.75,e.r*.7,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.lineCap="round";
    const legs=Math.sin(t*12)*.3;
    ctx.beginPath();ctx.moveTo(-e.r*.35,0);ctx.lineTo(-e.r*(1+legs),e.r*.8);ctx.moveTo(e.r*.35,0);ctx.lineTo(e.r*(1-legs),e.r*.8);ctx.stroke();
    ctx.fillStyle="#d19b79";ctx.beginPath();ctx.ellipse(0,-e.r*.5,e.r*.48,e.r*.42,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2b100d";ctx.beginPath();ctx.arc(-e.r*.16,-e.r*.54,e.r*.08,0,Math.PI*2);ctx.arc(e.r*.16,-e.r*.54,e.r*.08,0,Math.PI*2);ctx.fill();

  }else if(e.kind==="Spitter"){
    const pulse2=1+Math.sin(t*5)*.08;
    ctx.scale(1,pulse2);
    ctx.beginPath();ctx.ellipse(0,0,e.r*.8,e.r,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#b87a5a";ctx.beginPath();ctx.arc(0,-e.r*.45,e.r*.55,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2a100d";ctx.beginPath();ctx.arc(-e.r*.2,-e.r*.5,e.r*.09,0,Math.PI*2);ctx.arc(e.r*.2,-e.r*.5,e.r*.09,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d85b43";ctx.beginPath();ctx.ellipse(e.r*.65,0,e.r*.3,e.r*.18,0,0,Math.PI*2);ctx.fill();
    if(e.attackTimer<.35){ctx.shadowBlur=18;ctx.shadowColor="#d85b43";ctx.fillStyle="#e87a52";ctx.beginPath();ctx.arc(e.r*.72,0,e.r*.12,0,Math.PI*2);ctx.fill();}

  }else if(e.kind==="Bomber"){
    const swell=1+Math.sin(t*7)*.08;
    ctx.scale(swell,swell);
    ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d96a45";ctx.beginPath();ctx.arc(0,0,e.r*.42,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2a100d";
    ctx.beginPath();ctx.arc(-e.r*.22,-e.r*.18,e.r*.1,0,Math.PI*2);ctx.arc(e.r*.22,-e.r*.18,e.r*.1,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#d96a45";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-e.r*.8);ctx.lineTo(e.r*.45,-e.r*1.15);ctx.stroke();
    ctx.fillStyle="#f2a15f";ctx.shadowBlur=10;ctx.shadowColor="#e06b45";
    ctx.beginPath();ctx.arc(e.r*.5,-e.r*1.2,e.r*.13,0,Math.PI*2);ctx.fill();
  }else{
    const skitter=Math.sin(t*18)*e.r*.12;
    ctx.translate(0,skitter);
    ctx.beginPath();ctx.ellipse(0,0,e.r*1.1,e.r*.55,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.lineCap="round";
    for(let side=-1;side<=1;side+=2){
      for(let row=0;row<2;row++){
        const phase=Math.sin(t*15+row*2)*.25;
        ctx.beginPath();ctx.moveTo(side*e.r*.35,(row-.5)*e.r*.3);ctx.lineTo(side*e.r*(1.1+phase),((row-.5)*.65)*e.r);ctx.stroke();
      }
    }
    ctx.fillStyle="#d09a78";ctx.beginPath();ctx.arc(e.r*.7,-e.r*.08,e.r*.22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#2b100d";ctx.beginPath();ctx.arc(e.r*.76,-e.r*.12,e.r*.06,0,Math.PI*2);ctx.fill();
  }

  ctx.restore();
}
function drawBoss(e){
  ctx.save();ctx.translate(e.x,e.y);const pulse=1+Math.sin(runTime*4)*.04;ctx.scale(pulse,pulse);ctx.shadowBlur=30;ctx.shadowColor=e.color;ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="#d09a78";ctx.globalAlpha=.65;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,e.r*.7,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#1b0f0c";ctx.globalAlpha=1;ctx.beginPath();ctx.arc(-e.r*.28,-e.r*.12,e.r*.12,0,Math.PI*2);ctx.arc(e.r*.28,-e.r*.12,e.r*.12,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawBullet(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.shadowBlur=12;ctx.shadowColor="#e2c8a5";ctx.fillStyle="#f0d6b0";ctx.fillRect(-7,-Math.max(1,b.r*.45),14,Math.max(2,b.r*.9));ctx.restore();
}
function drawEnemyBullet(b){
  ctx.save();ctx.shadowBlur=12;ctx.shadowColor="#e36d72";ctx.fillStyle="#d86b4c";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawParticles(){
  for(const p of particles){
    ctx.save();
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life));
    const type=p.type;
    if(type==="explosion"){
      ctx.fillStyle=p.life>.45?"#ffb15c":"#d84b35";
      ctx.shadowBlur=14;ctx.shadowColor="#e0643f";
    }else if(type==="wispDeath"){
      ctx.fillStyle="#c98b9b";
    }else if(type==="stalkerDeath"){
      ctx.fillStyle="#7b5547";
    }else if(type==="swiftDeath"){
      ctx.fillStyle="#e08b55";
    }else if(type==="bruteDeath"){
      ctx.fillStyle="#a44b38";
    }else if(type==="ghoulDeath"){
      ctx.fillStyle="#9f705d";
    }else if(type==="leaperDeath"){
      ctx.fillStyle="#d35d43";
    }else if(type==="spitterDeath"){
      ctx.fillStyle="#9b6b42";
    }else if(type==="crawlerDeath"){
      ctx.fillStyle="#bd493b";
    }else{
      ctx.fillStyle=type==="damage"?"#c95746":type==="boss"?"#b84b3f":"#d46a45";
    }
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*(type==="explosion"?1.4:1),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}
function drawVignette(){
  const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,"#0000");g.addColorStop(.72,"#0002");g.addColorStop(1,"#000b");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}