const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
let W=0,H=0,dpr=1,last=0,running=false,paused=false,level=1,xp=0,xpNeed=8,kills=0,timeLeft=600,hp=100,maxHp=100,score=0,spawn=0,shoot=0,enemyId=0,shake=0,dash=0;
const keys=new Set(),enemies=[],bullets=[],gems=[],particles=[],orbs=[];
const player={x:0,y:0,r:14,speed:210,damage:18,rate:.48,range:390,shots:1,spread:.16,magnet:70,regen:0,armor:0,crit:0,dashPower:500};
const upgrades=[
 {icon:'✦',name:'Moonlit Edge',desc:'+7 weapon damage',apply:()=>player.damage+=7},
 {icon:'◈',name:'Quick Hands',desc:'Fire 18% faster',apply:()=>player.rate*=.82},
 {icon:'✧',name:'Split Shot',desc:'+1 projectile per volley',apply:()=>player.shots++},
 {icon:'◇',name:'Fleetfoot',desc:'+12% movement speed',apply:()=>player.speed*=1.12},
 {icon:'◎',name:'Blood Moon',desc:'+15 maximum health and heal 15',apply:()=>{maxHp+=15;hp=Math.min(maxHp,hp+15)}},
 {icon:'⊙',name:'Long Sight',desc:'+80 attack range',apply:()=>player.range+=80},
 {icon:'❖',name:'Essence Magnet',desc:'+55 pickup radius',apply:()=>player.magnet+=55},
 {icon:'†',name:'Vital Spark',desc:'Regenerate 1 HP every 5 seconds',apply:()=>player.regen+=1},
 {icon:'✹',name:'Piercing Star',desc:'Projectiles pierce +1 enemy',apply:()=>player.pierce=(player.pierce||0)+1},
 {icon:'☄',name:'Critical Night',desc:'+8% critical strike chance',apply:()=>player.crit+=.08},
 {icon:'⌁',name:'Dash Core',desc:'Dash cooldown reduced by 20%',apply:()=>player.dashCd=(player.dashCd||2.5)*.8},
 {icon:'✺',name:'Heavy Rounds',desc:'+25% projectile size',apply:()=>player.bulletSize=(player.bulletSize||1)*1.25}
];
const enemyTypes=[
 {r:11,hp:28,speed:54,damage:10,color:0},
 {r:15,hp:52,speed:43,damage:14,color:1},
 {r:9,hp:18,speed:82,damage:8,color:2},
 {r:22,hp:110,speed:29,damage:20,color:3}
];
function resize(){dpr=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='p'&&running)togglePause();if(e.code==='Space'&&running&&!paused)tryDash()});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
$('start-btn').onclick=()=>start();$('resume-btn').onclick=()=>togglePause();$('quit-btn').onclick=()=>end(false);$('again-btn').onclick=()=>start();

function start(){level=1;xp=0;xpNeed=8;kills=0;timeLeft=600;hp=maxHp=100;score=0;Object.assign(player,{x:W/2,y:H/2,r:14,speed:210,damage:18,rate:.48,range:390,shots:1,spread:.16,magnet:70,regen:0,armor:0,crit:0,pierce:0,bulletSize:1,dashCd:2.5});enemies.length=0;bullets.length=0;gems.length=0;particles.length=0;orbs.length=0;spawn=0;shoot=0;dash=0;running=true;paused=false;$('start').classList.add('hidden');$('end').classList.add('hidden');$('pause').classList.add('hidden');$('upgrade').classList.add('hidden');last=performance.now();requestAnimationFrame(loop)}
function togglePause(){paused=!paused;$('pause').classList.toggle('hidden',!paused);if(!paused){last=performance.now();requestAnimationFrame(loop)}}
function loop(now){if(!running||paused)return;const dt=Math.min((now-last)/1000,.033);last=now;update(dt);draw();requestAnimationFrame(loop)}
function update(dt){timeLeft-=dt;if(timeLeft<=0){timeLeft=0;end(true);return}shake=Math.max(0,shake-dt*20);move(dt);spawn+=dt;shoot-=dt;dash=Math.max(0,dash-dt);if(spawn>spawnInterval()){spawn=0;spawnEnemy()}if(shoot<=0){shoot=player.rate;fire()}updateBullets(dt);updateEnemies(dt);updateGems(dt);updateParticles(dt);if(player.regen){player._regen=(player._regen||0)+dt;if(player._regen>5){player._regen=0;hp=Math.min(maxHp,hp+player.regen)}}ui()}
function spawnInterval(){return Math.max(.18,.78-timeLeft/1200)}
function move(dt){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const n=Math.hypot(x,y)||1;if(x||y){player.x+=x/n*player.speed*dt;player.y+=y/n*player.speed*dt}player.x=Math.max(25,Math.min(W-25,player.x));player.y=Math.max(75,Math.min(H-25,player.y))}
function tryDash(){if(dash>0)return;let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(!x&&!y)y=-1;const n=Math.hypot(x,y)||1;player.x=Math.max(25,Math.min(W-25,player.x+x/n*player.dashPower));player.y=Math.max(75,Math.min(H-25,player.y+y/n*player.dashPower));dash=player.dashCd||2.5;burst(player.x,player.y,16,'dash')}
function nearest(){let best=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<bd&&d<player.range){bd=d;best=e}}return best}
function fire(){const target=nearest();if(!target)return;const base=Math.atan2(target.y-player.y,target.x-player.x);for(let i=0;i<player.shots;i++){const off=(i-(player.shots-1)/2)*player.spread;const a=base+off+(Math.random()-.5)*.025;bullets.push({x:player.x,y:player.y,vx:Math.cos(a)*650,vy:Math.sin(a)*650,r:4*(player.bulletSize||1),damage:player.damage*(Math.random()<player.crit?2:1),life:1.2,pierce:player.pierce||0,hit:new Set()})}}
function spawnEnemy(){const edge=Math.floor(Math.random()*4),pad=35;let x=edge<2?(edge?W+pad:-pad):Math.random()*W,y=edge<2?Math.random()*H:(edge===2?-pad:H+pad);let t=enemyTypes[Math.min(3,Math.floor(Math.random()*(timeLeft<300?4:3)))];const scale=1+(600-timeLeft)/420;enemies.push({id:enemyId++,x,y,r:t.r,hp:t.hp*scale,max:t.hp*scale,speed:t.speed*(1+(600-timeLeft)/1400),damage:t.damage,kind:t.color,flash:0})}
function updateBullets(dt){for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let remove=b.life<=0||b.x<-30||b.x>W+30||b.y<-30||b.y>H+30;for(const e of enemies){if(remove||b.hit.has(e.id))continue;if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){b.hit.add(e.id);e.hp-=b.damage;e.flash=.08;burst(b.x,b.y,3,'hit');if(e.hp<=0)kill(e);if(b.hit.size>b.pierce)remove=true}}if(remove)bullets.splice(i,1)}}
function kill(e){const idx=enemies.indexOf(e);if(idx>=0)enemies.splice(idx,1);kills++;score+=10+Math.floor(e.max);gems.push({x:e.x,y:e.y,v:3+e.max/25,r:5});burst(e.x,e.y,7,'kill')}
function updateEnemies(dt){for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],a=Math.atan2(player.y-e.y,player.x-e.x),d=Math.hypot(player.x-e.x,player.y-e.y);e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;e.flash=Math.max(0,e.flash-dt);if(d<e.r+player.r){hp-=Math.max(1,e.damage-player.armor)*dt*3;shake=3;if(hp<=0){hp=0;end(false);return}}}}
function updateGems(dt){for(let i=gems.length-1;i>=0;i--){const g=gems[i],d=Math.hypot(player.x-g.x,player.y-g.y);if(d<player.magnet){g.x+=(player.x-g.x)/Math.max(d,1)*280*dt;g.y+=(player.y-g.y)/Math.max(d,1)*280*dt}if(d<player.r+g.r+5){xp+=g.v;gems.splice(i,1);burst(g.x,g.y,2,'xp');if(xp>=xpNeed){xp-=xpNeed;xpNeed=Math.floor(xpNeed*1.27+2);levelUp()}}}}
function burst(x,y,n,type){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.5,type})}}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;if(p.life<=0)particles.splice(i,1)}}
function levelUp(){paused=true;const pool=[...upgrades].sort(()=>Math.random()-.5).slice(0,3),box=$('choices');box.innerHTML='';pool.forEach(u=>{const b=document.createElement('div');b.className='choice';b.innerHTML='<div class="icon">'+u.icon+'</div><strong>'+u.name+'</strong><span>'+u.desc+'</span>';b.onclick=()=>{u.apply();$('upgrade').classList.add('hidden');paused=false;last=performance.now();level++;requestAnimationFrame(loop)};box.appendChild(b)});$('upgrade').classList.remove('hidden')}
function ui(){const m=Math.floor(timeLeft/60),s=Math.floor(timeLeft%60);$('time').textContent=m+':'+String(s).padStart(2,'0');$('level').textContent=level;$('kills').textContent=kills;$('xp-fill').style.width=Math.min(100,xp/xpNeed*100)+'%';$('hp-fill').style.width=hp/maxHp*100+'%';$('hp-text').textContent=Math.ceil(hp)+' / '+maxHp}
function end(win){running=false;paused=false;$('pause').classList.add('hidden');$('upgrade').classList.add('hidden');$('end').classList.remove('hidden');$('end-kicker').textContent=win?'DAWN BREAKS':'THE DARKNESS WON';$('end-title').textContent=win?'You survived the night.':'You were swallowed by the night.';$('end-stats').textContent='Level '+level+' · '+kills+' enemies defeated · '+score+' essence'}
function draw(){ctx.save();let sx=(Math.random()-.5)*shake,sy=(Math.random()-.5)*shake;ctx.translate(sx,sy);ctx.fillStyle='#090812';ctx.fillRect(-10,-10,W+20,H+20);drawStars();for(const g of gems)drawGem(g);for(const e of enemies)drawEnemy(e);for(const b of bullets)drawBullet(b);drawPlayer();for(const p of particles)drawParticle(p);ctx.restore();vignette()}
function drawStars(){ctx.fillStyle='#141321';for(let x=0;x<W;x+=52)for(let y=75;y<H;y+=52){const n=Math.sin(x*12.9898+y*78.233)*43758.5453%1;if(n>.72)ctx.fillRect(x+((n+1)*20)%40,y+((n+1)*13)%40,1,1)}}
function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.shadowBlur=20;ctx.shadowColor='#b7e9ff';ctx.fillStyle='#dff6ff';ctx.beginPath();ctx.arc(0,0,player.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#7aa5bb';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2(player.y-e.y,player.x-e.x));ctx.shadowBlur=12;ctx.shadowColor=e.kind===3?'#e08b62':'#9d526d';ctx.fillStyle=e.flash?'#fff':(['#8c4c67','#b15c55','#705c9e','#b87955'][e.kind]);ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#160f19';ctx.beginPath();ctx.arc(e.r*.35,-e.r*.25,2,0,7);ctx.arc(e.r*.35,e.r*.25,2,0,7);ctx.fill();ctx.restore()}
function drawBullet(b){ctx.fillStyle='#d9f4ff';ctx.shadowBlur=10;ctx.shadowColor='#9ee3ff';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();ctx.shadowBlur=0}
function drawGem(g){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(performance.now()/600);ctx.fillStyle='#a9e7ff';ctx.shadowBlur=12;ctx.shadowColor='#79d6ff';ctx.beginPath();ctx.moveTo(0,-g.r);ctx.lineTo(g.r,0);ctx.lineTo(0,g.r);ctx.lineTo(-g.r,0);ctx.closePath();ctx.fill();ctx.restore()}
function drawParticle(p){ctx.globalAlpha=Math.max(0,p.life*1.8);ctx.fillStyle=p.type==='dash'?'#d9f4ff':p.type==='xp'?'#9fe4ff':'#c47b86';ctx.fillRect(p.x,p.y,2.5,2.5);ctx.globalAlpha=1}
function vignette(){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.15,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,'transparent');g.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
