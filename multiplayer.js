if(!window.supabase){
  const unavailable=async()=>{
    const el=document.getElementById("mp-status");
    if(el)el.textContent="Multiplayer unavailable · Solo mode still works";
    return false;
  };
  window.NightfallMP={host:unavailable,join:unavailable,leave:async()=>{},tick:()=>{},drawRemote:()=>{},get enabled(){return false},get room(){return null},get isHost(){return false}};
}else{
const NIGHTFALL_SUPABASE_URL="https://dkwmkvruzebnqlmvwzhy.supabase.co";
const NIGHTFALL_SUPABASE_KEY="sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P";
const mpId=crypto.randomUUID();
const mpName="Player-"+mpId.slice(0,4).toUpperCase();
const nightfallSupabase=window.supabase.createClient(NIGHTFALL_SUPABASE_URL,NIGHTFALL_SUPABASE_KEY,{global:{headers:{"x-nightfall-client-id":mpId}}});
let mpChannel=null,mpRoom=null,mpHost=false,mpConnected=false,mpLastSend=0,mpLastRoomHeartbeat=0,mpRoomMax=4,mpJoinBusy=false;
const remotePlayers=new Map();

function mpSetStatus(text){const el=document.getElementById("mp-status");if(el)el.textContent=text}
function mpSetRoomUI(code,count=1,max=4){
  const room=document.getElementById("mp-room"),codeEl=document.getElementById("room-code"),playersEl=document.getElementById("room-players");
  if(codeEl)codeEl.textContent=code||"------";
  if(playersEl)playersEl.textContent=count+"/"+max+" PLAYERS";
  if(room)room.classList.toggle("hidden",!code);
}
function mpRoomUrl(code){return location.href.split("#")[0]+"#room="+encodeURIComponent(code)}
function mpCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="";
  for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function mpWireRoomButtons(){
  const copyCode=document.getElementById("copy-room-code"),copyInvite=document.getElementById("copy-invite");
  if(copyCode)copyCode.onclick=async()=>{
    try{await navigator.clipboard.writeText(mpRoom);mpSetStatus("Room code copied")}
    catch{mpSetStatus("Room code: "+mpRoom)}
  };
  if(copyInvite)copyInvite.onclick=async()=>{
    try{await navigator.clipboard.writeText(mpRoomUrl(mpRoom));mpSetStatus("Invite link copied")}
    catch{mpSetStatus("Room code: "+mpRoom)}
  };
}
function mpPresenceIds(){return mpChannel?Object.keys(mpChannel.presenceState()):[]}
async function mpRefreshRoomRecord(){
  if(!mpHost||!mpRoom||!mpChannel)return;
  const count=Math.max(1,Math.min(mpRoomMax,mpPresenceIds().length)),now=new Date();
  const {error}=await nightfallSupabase.from("nightfall_rooms").update({
    player_count:count,last_seen:now.toISOString(),expires_at:new Date(now.getTime()+15*60*1000).toISOString(),status:"waiting"
  }).eq("room_code",mpRoom).eq("host_id",mpId);
  if(!error)mpSetRoomUI(mpRoom,count,mpRoomMax);
}
async function mpJoinChannel(code,maxPlayers=4){
  if(mpChannel){try{await nightfallSupabase.removeChannel(mpChannel)}catch{}mpChannel=null}
  mpRoomMax=Math.max(2,Math.min(4,Number(maxPlayers)||4));remotePlayers.clear();
  const channel=nightfallSupabase.channel("nightfall:"+code,{config:{broadcast:{self:false,ack:true},presence:{key:mpId}}});
  mpChannel=channel;
  channel.on("broadcast",{event:"player-state"},({payload})=>{
    if(!payload||payload.id===mpId)return;
    remotePlayers.set(payload.id,{...payload,seen:performance.now()});
  }).on("broadcast",{event:"player-left"},({payload})=>{
    if(payload?.id)remotePlayers.delete(payload.id);
  }).on("presence",{event:"sync"},async()=>{
    if(channel!==mpChannel)return;
    const ids=mpPresenceIds();
    for(const id of remotePlayers.keys())if(!ids.includes(id))remotePlayers.delete(id);
    const count=Math.min(mpRoomMax,ids.length);
    mpSetRoomUI(mpRoom,count,mpRoomMax);
    mpSetStatus((mpHost?"HOST":"CO-OP")+" · "+count+"/"+mpRoomMax+" players");
    if(mpHost)await mpRefreshRoomRecord();
  });
  return await new Promise(resolve=>{
    let settled=false;
    const finish=v=>{if(settled)return;settled=true;resolve(v)};
    const timeout=setTimeout(async()=>{
      if(settled)return;mpConnected=false;mpSetStatus("Multiplayer connection timed out");
      try{await nightfallSupabase.removeChannel(channel)}catch{}if(mpChannel===channel)mpChannel=null;finish(false);
    },9000);
    channel.subscribe(async(status,err)=>{
      if(status==="SUBSCRIBED"){
        clearTimeout(timeout);
        try{
          const tracked=await channel.track({id:mpId,name:mpName,online_at:new Date().toISOString()});
          if(tracked==="error")throw new Error("Presence tracking failed");
          mpConnected=true;mpWireRoomButtons();await new Promise(r=>setTimeout(r,300));
          const ids=mpPresenceIds();
          if(ids.length>mpRoomMax){
            mpConnected=false;mpSetStatus("That room is full");
            try{await channel.untrack()}catch{}try{await nightfallSupabase.removeChannel(channel)}catch{}
            if(mpChannel===channel)mpChannel=null;finish(false);return;
          }
          mpSetRoomUI(mpRoom,Math.min(mpRoomMax,ids.length),mpRoomMax);
          mpSetStatus((mpHost?"HOST":"CO-OP")+" · connected");
          if(mpHost)await mpRefreshRoomRecord();
          finish(true);
        }catch(error){
          mpConnected=false;mpSetStatus("Multiplayer setup failed · "+(error?.message||"unknown error"));
          try{await nightfallSupabase.removeChannel(channel)}catch{}if(mpChannel===channel)mpChannel=null;finish(false);
        }
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
        clearTimeout(timeout);mpConnected=false;
        mpSetStatus("Multiplayer connection failed"+(err?.message?" · "+err.message:""));
        try{await nightfallSupabase.removeChannel(channel)}catch{}if(mpChannel===channel)mpChannel=null;finish(false);
      }
    });
  });
}
async function mpHostRoom(){
  if(mpJoinBusy)return false;mpJoinBusy=true;mpSetStatus("Creating room…");
  try{
    await mpLeave(false);
    let code=null,error=null;
    for(let attempt=0;attempt<5;attempt++){
      code=mpCode();
      const result=await nightfallSupabase.from("nightfall_rooms").insert({
        room_code:code,host_id:mpId,host_name:mpName,player_count:1,max_players:4,status:"waiting",expires_at:new Date(Date.now()+15*60*1000).toISOString()
      });
      error=result.error;if(!error)break;
    }
    if(error){mpSetStatus("Could not create room · "+error.message);return false}
    mpRoom=code;mpHost=true;mpRoomMax=4;mpSetRoomUI(code,1,4);mpWireRoomButtons();
    const connected=await mpJoinChannel(code,4);
    if(!connected){await mpLeave(true);return false}
    mpSetStatus("HOST · room "+code+" · waiting for players");return true;
  }finally{mpJoinBusy=false}
}
async function mpJoinRoom(code){
  if(mpJoinBusy)return false;mpJoinBusy=true;
  try{
    code=(code||"").trim().toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)){mpSetStatus("Enter a 6-character room code");return false}
    await mpLeave(false);mpSetStatus("Looking for room…");
    const {data,error}=await nightfallSupabase.from("nightfall_rooms").select("room_code,player_count,max_players,status,expires_at").eq("room_code",code).maybeSingle();
    if(error){mpSetStatus("Room lookup failed · "+error.message);return false}
    if(!data){mpSetStatus("Room not found");return false}
    if(data.status==="closed"){mpSetStatus("That room is closed");return false}
    if(data.expires_at&&new Date(data.expires_at)<=new Date()){mpSetStatus("That room expired");return false}
    if(Number(data.player_count)>=Number(data.max_players)){mpSetStatus("That room is full");return false}
    mpRoom=code;mpHost=false;mpRoomMax=Math.max(2,Math.min(4,Number(data.max_players)||4));
    mpSetRoomUI(code,Number(data.player_count)||1,mpRoomMax);
    const connected=await mpJoinChannel(code,mpRoomMax);
    if(!connected){mpRoom=null;mpSetRoomUI("",0,mpRoomMax);return false}
    mpSetStatus("CO-OP · room "+code+" · connected");return true;
  }finally{mpJoinBusy=false}
}
async function mpLeave(deleteRoom=true){
  const oldRoom=mpRoom,wasHost=mpHost;mpConnected=false;remotePlayers.clear();
  if(mpChannel){
    try{await mpChannel.send({type:"broadcast",event:"player-left",payload:{id:mpId}})}catch{}
    try{await mpChannel.untrack()}catch{}
    try{await nightfallSupabase.removeChannel(mpChannel)}catch{}
  }
  mpChannel=null;mpRoom=null;mpHost=false;mpLastSend=0;mpLastRoomHeartbeat=0;mpSetRoomUI("",0,4);
  if(deleteRoom&&oldRoom&&wasHost)await nightfallSupabase.from("nightfall_rooms").delete().eq("room_code",oldRoom).eq("host_id",mpId);
}
function mpTick(){
  if(!mpConnected||!mpChannel||typeof player==="undefined")return;
  const now=performance.now();
  if(now-mpLastSend>=50){
    mpLastSend=now;
    mpChannel.send({type:"broadcast",event:"player-state",payload:{id:mpId,name:mpName,x:player.x,y:player.y,aimX:cameraX-W/2+mouseX,aimY:cameraY-H/2+mouseY,hits,maxHits,level,runTime}});
  }
  for(const [id,p] of remotePlayers)if(now-(p.seen||now)>3500)remotePlayers.delete(id);
  if(mpHost&&now-mpLastRoomHeartbeat>=15000){mpLastRoomHeartbeat=now;mpRefreshRoomRecord()}
}
function mpDrawRemote(ctx){
  for(const p of remotePlayers.values()){
    const a=Math.atan2(p.aimY-p.y,p.aimX-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=.9;
    ctx.shadowBlur=16;ctx.shadowColor="#d46a45";ctx.fillStyle="#d9c2a5";ctx.beginPath();ctx.arc(0,-8,7,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle="#60493b";ctx.beginPath();ctx.roundRect(-8,0,16,20,6);ctx.fill();
    ctx.strokeStyle="#c9a985";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-5,5);ctx.lineTo(5,7);ctx.stroke();
    ctx.save();ctx.rotate(a);ctx.fillStyle="#33251e";ctx.fillRect(4,3,28,6);ctx.fillStyle="#9b6048";ctx.fillRect(29,4,4,4);ctx.restore();
    ctx.fillStyle="#e2c8a5";ctx.font="900 9px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(p.name||"PLAYER",0,-24);ctx.restore();
  }
}
function mpReadHash(){
  const match=location.hash.match(/(?:^|#|&)room=([^&]+)/);if(!match)return;
  const code=decodeURIComponent(match[1]||"").toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return;
  const input=document.getElementById("join-code");if(input)input.value=code;mpSetStatus("Invite link detected · press JOIN");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mpReadHash,{once:true});else mpReadHash();
addEventListener("beforeunload",()=>{
  if(!mpHost||!mpRoom)return;
  try{navigator.sendBeacon(NIGHTFALL_SUPABASE_URL+"/rest/v1/nightfall_rooms?room_code=eq."+encodeURIComponent(mpRoom)+"&host_id=eq."+encodeURIComponent(mpId),new Blob([""],{type:"application/json"}))}catch{}
});
window.NightfallMP={host:mpHostRoom,join:mpJoinRoom,leave:mpLeave,tick:mpTick,drawRemote:mpDrawRemote,get enabled(){return mpConnected},get room(){return mpRoom},get isHost(){return mpHost}};
}