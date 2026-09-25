const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);

let W=0,H=0,dpr=1,last=0,running=false,paused=false;
let level=1,xp=0,xpNeed=10,kills=0,timeLeft=600,hp=100,maxHp=100,score=0;
let spawnTimer=0,shootTimer=0,dashTimer=0,enemyId=0,shake=0,pendingLevels=0;
let mouseX=0,mouseY=0,mouseDown=false,runTime=0,gunKick=0;
let boss=null,bossesDefeated=0,nextBossTime=480,bossWarningTimer=0,toastTimer=0;

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
 {icon:"◎",name:"Blood Moon",desc:"+15 max health and heal 15",apply:()=>{maxHp+=15;hp=Math.min(maxHp,hp+15)}},
 {icon:"⊙",name:"Long Sight",desc:"+80 attack range",apply:()=>player.range+=80},
 {icon:"❖",name:"Essence Magnet",desc:"+55 pickup radius",apply:()=>player.magnet+=55},
 {icon:"†",name:"Vital Spark",desc:"+1 HP regeneration every 5 seconds",apply:()=>player.regen++},
 {icon:"✹",name:"Piercing Star",desc:"Projectiles pierce +1 enemy",apply:()=>player.pierce++},
 {icon:"☄",name:"Critical Night",desc:"+8% critical strike chance",apply:()=>player.crit+=.08},
 {icon:"⌁",name:"Dash Core",desc:"Dash cooldown reduced by 20%",apply:()=>player.dashCd=Math.max(.55,player.dashCd*.8)},
 {icon:"✺",name:"Heavy Rounds",desc:"+25% projectile size and +2 damage",apply:()=>{player.bulletSize*=1.25;player.damage+=2}},
 {icon:"♥",name:"Sanguine Pact",desc:"Heal 8% of max health",apply:()=>hp=Math.min(maxHp,hp+maxHp*.08)},
 {icon:"☀",name:"Solar Core",desc:"+12% projectile speed and +15 range",apply:()=>{player.projectileSpeed=(player.projectileSpeed||650)*1.12;player.range+=15}},
 {icon:"⚔",name:"Executioner",desc:"+15% damage against enemies below 40% HP",apply:()=>player.execute=(player.execute||0)+.15}
];

const enemyTypes=[
 {name:"Wisp",r:10,hp:24,speed:58,damage:8,color:"#8c4c67",xp:3},
 {name:"Stalker",r:14,hp:48,speed:46,damage:12,color:"#b15c55",xp:5},
 {name:"Swift",r:8,hp:16,speed:88,damage:7,color:"#705c9e",xp:2},
 {name:"Brute",r:22,hp:120,speed:30,damage:19,color:"#b87955",xp:12}
];

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
  if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(key))e.preventDefault();
  if(key==="p"&&running&&!isUpgradeOpen())togglePause();
  if(e.code==="Space"&&running&&!paused&&!isUpgradeOpen())tryDash();
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

$("start-btn").addEventListener("click",()=>start());
$("resume-btn").addEventListener("click",()=>togglePause());
$("quit-btn").onclick=()=>end(false);
$("again-btn").addEventListener("click",()=>start());

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

function start(){
  level=1;xp=0;xpNeed=10;kills=0;timeLeft=600;hp=maxHp=100;score=0;
  spawnTimer=0;shootTimer=0;dashTimer=0;enemyId=0;shake=0;pendingLevels=0;runTime=0;gunKick=0;
  bossesDefeated=0;nextBossTime=480;bossWarningTimer=0;toastTimer=0;
  Object.assign(player,{
    x:W/2,y:H/2,r:14,speed:220,damage:18,rate:.46,range:410,shots:1,
    spread:.15,magnet:75,regen:0,armor:0,crit:0,pierce:0,bulletSize:1,
    dashPower:170,dashCd:2.4,invuln:0,projectileSpeed:650,execute:0,_regen:0
  });
  resetWorld();
  running=true;paused=false;keys.clear();
  mouseX=player.x+100;
  mouseY=player.y;
  mouseDown=false;
  $("start").classList.add("hidden");
  $("end").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("upgrade").classList.add("hidden");
  hideBossBar();
  ui();
  last=performance.now();
  requestAnimationFrame(loop);
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
  dashTimer=Math.max(0,dashTimer-dt);
  bossWarningTimer=Math.max(0,bossWarningTimer-dt);
  toastTimer=Math.max(0,toastTimer-dt);

  move(dt);

  if(!boss&&timeLeft<=nextBossTime){
    spawnBoss();
  }

  if(spawnTimer>=spawnInterval()){
    spawnTimer=0;
    const count=timeLeft<120?2:1;
    for(let i=0;i<count;i++)spawnEnemy();
  }

  if(mouseDown&&shootTimer<=0){
    shootTimer=player.rate;
    fire();
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
  ui();
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
  player.x=Math.max(24,Math.min(W-24,player.x));
  player.y=Math.max(72,Math.min(H-24,player.y));
}

function tryDash(){
  if(dashTimer>0)return;
  let x=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0);
  let y=(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0);
  if(!x&&!y)y=-1;
  const n=Math.hypot(x,y)||1;
  const oldX=player.x,oldY=player.y;
  player.x=Math.max(24,Math.min(W-24,player.x+x/n*player.dashPower));
  player.y=Math.max(72,Math.min(H-24,player.y+y/n*player.dashPower));
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

function fire(){
  const dx=mouseX-player.x;
  const dy=mouseY-player.y;
  if(Math.hypot(dx,dy)<1)return;

  const base=Math.atan2(dy,dx);
  const speed=player.projectileSpeed||650;
  gunKick=1;
  burst(player.x,player.y,2,"muzzle");

  for(let i=0;i<player.shots;i++){
    const off=(i-(player.shots-1)/2)*player.spread;
    const a=base+off+(Math.random()-.5)*.025;
    bullets.push({
      x:player.x+Math.cos(a)*24,y:player.y+Math.sin(a)*24,
      vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      r:4*player.bulletSize,
      damage:player.damage*(Math.random()<player.crit?2:1),
      life:1.3,pierce:player.pierce,hit:new Set()
    });
  }
}

function spawnEnemy(){
  const edge=Math.floor(Math.random()*4),pad=45;
  let x=edge<2?(edge?W+pad:-pad):Math.random()*W;
  let y=edge<2?Math.random()*H:(edge===2?-pad:H+pad);
  let available=timeLeft<280?4:timeLeft<430?3:2;
  const type=enemyTypes[Math.floor(Math.random()*available)];
  const scale=difficulty();
  enemies.push({
    id:enemyId++,x,y,r:type.r,hp:type.hp*scale,max:type.hp*scale,
    speed:type.speed*(1+(600-timeLeft)/1500),damage:type.damage,
    color:type.color,xp:type.xp,flash:0,kind:type.name
  });
}

function spawnBoss(){
  const index=bossesDefeated%bossTypes.length;
  const t=bossTypes[index];
  const scale=1+bossesDefeated*.35+(600-timeLeft)/1200;
  const side=Math.floor(Math.random()*4);
  let x=side===0?-80:side===1?W+80:Math.random()*W;
  let y=side===2?-80:side===3?H+80:Math.random()*H;
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
    let remove=b.life<=0||b.x<-50||b.x>W+50||b.y<-50||b.y>H+50;

    const targets=boss?[boss,...enemies]:enemies;
    for(const e of targets){
      if(!e||e.dead||remove||b.hit.has(e.id))continue;
      if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
        b.hit.add(e.id);
        let damage=b.damage;
        if(e!==boss&&player.execute&&e.hp/e.max<.4)damage*=1+player.execute;
        e.hp-=damage;
        e.flash=.08;
        burst(b.x,b.y,3,"hit");
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
    if(b.life<=0||b.x<-40||b.x>W+40||b.y<-40||b.y>H+40){
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
  burst(e.x,e.y,e.r>18?13:7,"kill");
  addRing(e.x,e.y,4,e.r*2,"kill");
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
  if(player.invuln>0)return;
  const reduced=Math.max(1,amount-player.armor);
  hp-=reduced;
  player.invuln=.22;
  shake=7;
  burst(player.x,player.y,9,"damage");
  if(hp<=0){
    hp=0;
    end(false);
  }
}

function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.dead)continue;
    const a=Math.atan2(player.y-e.y,player.x-e.x);
    const d=Math.hypot(player.x-e.x,player.y-e.y);
    e.x+=Math.cos(a)*e.speed*dt;
    e.y+=Math.sin(a)*e.speed*dt;
    e.flash=Math.max(0,e.flash-dt);

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
  xp+=value;
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
  $("hp-fill").style.width=Math.max(0,Math.min(100,hp/maxHp*100))+"%";
  $("hp-text").textContent=Math.ceil(hp)+" / "+Math.ceil(maxHp);

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
}

function hideBossBar(){
  $("boss-bar").classList.add("hidden");
}

function end(win){
  if(!running)return;
  running=false;
  paused=false;
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

  drawBackground();
  drawRings();
  for(const g of gems)drawGem(g);
  for(const e of enemies)drawEnemy(e);
  if(boss)drawBoss(boss);
  for(const b of enemyBullets)drawEnemyBullet(b);
  for(const b of bullets)drawBullet(b);
  drawPlayer();
  drawParticles();

  ctx.restore();
  drawVignette();
}

function drawBackground(){
  ctx.fillStyle="#090812";
  ctx.fillRect(-20,-20,W+40,H+40);

  const gradient=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,Math.max(W,H)*.8);
  gradient.addColorStop(0,"#121121");
  gradient.addColorStop(.5,"#0b0a14");
  gradient.addColorStop(1,"#05050a");
  ctx.fillStyle=gradient;
  ctx.fillRect(-20,-20,W+40,H+40);

  ctx.strokeStyle="#171523";
  ctx.lineWidth=1;
  const grid=64;
  for(let x=0;x<W;x+=grid){
    ctx.beginPath();ctx.moveTo(x,70);ctx.lineTo(x,H);ctx.stroke();
  }
  for(let y=70;y<H;y+=grid){
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }

  ctx.fillStyle="#242235";
  for(let x=20;x<W;x+=55){
    for(let y=85;y<H;y+=55){
      const n=Math.sin(x*12.9898+y*78.233)*43758.5453%1;
      if(n>.78)ctx.fillRect(x+((n+1)*18)%36,y+((n+1)*13)%36,1.5,1.5);
    }
  }
}

function drawPlayer(){
  ctx.save();
  ctx.translate(player.x,player.y);

  if(player.invuln>0&&Math.floor(player.invuln*30)%2===0)ctx.globalAlpha=.45;

  const aim=Math.atan2(mouseY-player.y,mouseX-player.x);
  const moving=keys.has("w")||keys.has("a")||keys.has("s")||keys.has("d")||
    keys.has("arrowup")||keys.has("arrowleft")||keys.has("arrowdown")||keys.has("arrowright");
  const frame=moving?Math.floor(runTime*10)%4:0;
  const steps=[[-2,2],[3,-2],[-2,-2],[3,2]];
  const step=steps[frame];
  const bob=moving?Math.sin(runTime*18)*1.2:0;

  ctx.fillStyle="#0008";
  ctx.beginPath();
  ctx.ellipse(0,12,16,7,0,0,Math.PI*2);
  ctx.fill();

  ctx.shadowBlur=18;
  ctx.shadowColor="#b7e9ff";
  ctx.fillStyle="#d9edf2";
  ctx.beginPath();
  ctx.roundRect(-9,-4+bob,18,23,7);
  ctx.fill();

  ctx.shadowBlur=0;
  ctx.fillStyle="#526b78";
  ctx.beginPath();
  ctx.roundRect(-8,1+bob,16,17,5);
  ctx.fill();
  ctx.fillStyle="#8fb5c2";
  ctx.fillRect(-2,3+bob,4,12);

  ctx.fillStyle="#dfeef0";
  ctx.beginPath();
  ctx.arc(0,-11+bob,8,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle="#18232b";
  ctx.beginPath();
  ctx.roundRect(-6,-14+bob,12,6,3);
  ctx.fill();
  ctx.fillStyle="#8fe1f4";
  ctx.fillRect(-4,-13+bob,8,2);

  ctx.strokeStyle="#34434d";
  ctx.lineWidth=5;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(-5,14+bob);ctx.lineTo(-7+step[0],23+step[1]);
  ctx.moveTo(5,14+bob);ctx.lineTo(7-step[0],23-step[1]);
  ctx.stroke();

  ctx.save();
  ctx.rotate(aim);
  ctx.strokeStyle="#c5d9de";
  ctx.lineWidth=5;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(-5,4+bob);ctx.lineTo(5,7+bob);
  ctx.moveTo(-5,8+bob);ctx.lineTo(5,7+bob);
  ctx.stroke();

  const kick=gunKick*4;
  ctx.translate(-kick,0);
  ctx.fillStyle="#222b31";
  ctx.fillRect(3,4+bob,17,6);
  ctx.fillStyle="#566a73";
  ctx.fillRect(10,2+bob,14,4);
  ctx.fillStyle="#11181d";
  ctx.fillRect(21,1+bob,16,4);
  ctx.fillRect(5,10+bob,7,3);
  ctx.fillStyle="#a8e8f7";
  ctx.shadowBlur=12;
  ctx.shadowColor="#8fe1f4";
  ctx.fillRect(36,1+bob,3,4);

  if(gunKick>0){
    ctx.fillStyle="#fff4b0";
    ctx.shadowBlur=18;
    ctx.shadowColor="#ffcc66";
    ctx.beginPath();
    ctx.moveTo(39,3+bob);
    ctx.lineTo(49+gunKick*5,0+bob);
    ctx.lineTo(46+gunKick*4,4+bob);
    ctx.lineTo(49+gunKick*5,8+bob);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.shadowBlur=10;
  ctx.shadowColor="#8adfff";
  ctx.strokeStyle="#d9f4ff88";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(0,5,19,0,Math.PI*2);
  ctx.stroke();

  ctx.restore();
}
// Runtime integrity marker: keep Pages deployment synchronized with the fixed single-copy game script.
