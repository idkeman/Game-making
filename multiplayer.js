const NIGHTFALL_SUPABASE_URL="https://dkwmkvruzebnqlmvwzhy.supabase.co";
const NIGHTFALL_SUPABASE_KEY="sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P";
const nightfallSupabase=window.supabase.createClient(NIGHTFALL_SUPABASE_URL,NIGHTFALL_SUPABASE_KEY);
const mpId=crypto.randomUUID();
const mpName="Player-"+mpId.slice(0,4).toUpperCase();
let mpChannel=null,mpRoom=null,mpHost=false,mpConnected=false,mpLastSend=0;
const remotePlayers=new Map();

function mpSetStatus(text){
  const el=document.getElementById("mp-status");
  if(el)el.textContent=text;
}
function mpCode(){
  return Math.random().toString(36).slice(2,8).toUpperCase();
}
function mpRoomUrl(code){
  return location.href.split("#")[0]+"#room="+encodeURIComponent(code);
}
async function mpJoinChannel(code){
  if(mpChannel)await nightfallSupabase.removeChannel(mpChannel);
  mpChannel=nightfallSupabase.channel("nightfall:"+code,{
    config:{broadcast:{self:false},presence:{key:mpId}}
  });
  mpChannel
    .on("broadcast",{event:"player-state"},({payload})=>{
      if(!payload||payload.id===mpId)return;
      remotePlayers.set(payload.id,{...payload,seen:performance.now()});
    })
    .on("broadcast",{event:"player-left"},({payload})=>{
      if(payload?.id)remotePlayers.delete(payload.id);
    })
    .on("presence",{event:"sync"},async()=>{
      const state=mpChannel.presenceState();
      const ids=new Set(Object.keys(state));
      for(const id of remotePlayers.keys())if(!ids.has(id))remotePlayers.delete(id);
      if(mpHost&&mpRoom){
        const count=Math.max(1,Math.min(4,ids.size));
        await nightfallSupabase.from("nightfall_rooms").update({player_count:count,last_seen:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString()}).eq("room_code",mpRoom).eq("host_id",mpId);
      }
      mpSetStatus((mpHost?"HOST":"CO-OP")+" · "+ids.size+"/4 players");
    })
    .subscribe(async status=>{
      if(status==="SUBSCRIBED"){
        mpConnected=true;
        await mpChannel.track({name:mpName,online_at:new Date().toISOString()});
        mpSetStatus((mpHost?"HOST":"CO-OP")+" · connected");
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
        mpSetStatus("Multiplayer connection failed");
      }
    });
}
async function mpHostRoom(){
  const code=mpCode();
  const {error}=await nightfallSupabase.from("nightfall_rooms").insert({
    room_code:code,host_id:mpId,host_name:mpName,max_players:4,status:"waiting",
    expires_at:new Date(Date.now()+120000).toISOString()
  });
  if(error){mpSetStatus("Could not create room: "+error.message);return false}
  mpRoom=code;mpHost=true;
  document.getElementById("room-code").value=code;
  document.getElementById("mp-room").classList.remove("hidden");
  document.getElementById("copy-room").onclick=async()=>{
    try{await navigator.clipboard.writeText(mpRoomUrl(code));mpSetStatus("Invite link copied");}
    catch{mpSetStatus("Room code: "+code)}
  };
  await mpJoinChannel(code);
  return true;
}
async function mpJoinRoom(code){
  code=(code||"").trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)){mpSetStatus("Enter a 6-character room code");return false}
  const {data,error}=await nightfallSupabase.from("nightfall_rooms").select("*").eq("room_code",code).maybeSingle();
  if(error||!data){mpSetStatus("Room not found");return false}
  if(data.expires_at&&new Date(data.expires_at)<new Date()){mpSetStatus("That room expired");return false}
  if(data.player_count>=data.max_players){mpSetStatus("That room is full");return false}
  mpRoom=code;mpHost=false;
  await nightfallSupabase.from("nightfall_rooms").update({
    player_count:Math.min(data.max_players,data.player_count+1),
    last_seen:new Date().toISOString(),
    expires_at:new Date(Date.now()+120000).toISOString()
  }).eq("room_code",code);
  document.getElementById("mp-room").classList.remove("hidden");
  await mpJoinChannel(code);
  return true;
}
async function mpLeave(){
  if(mpChannel){
    try{await mpChannel.send({type:"broadcast",event:"player-left",payload:{id:mpId}})}catch{}
    await nightfallSupabase.removeChannel(mpChannel);
  }
  if(mpRoom&&mpHost)await nightfallSupabase.from("nightfall_rooms").delete().eq("room_code",mpRoom).eq("host_id",mpId);
  mpChannel=null;mpRoom=null;mpHost=false;mpConnected=false;remotePlayers.clear();
}
function mpTick(dt){
  if(!mpConnected||!mpChannel||typeof player==="undefined")return;
  const now=performance.now();
  if(now-mpLastSend<50)return;
  mpLastSend=now;
  mpChannel.send({type:"broadcast",event:"player-state",payload:{
    id:mpId,name:mpName,x:player.x,y:player.y,aimX:cameraX-W/2+mouseX,aimY:cameraY-H/2+mouseY,
    hits,maxHits,level,runTime
  }});
  for(const [id,p] of remotePlayers){
    if(now-(p.seen||now)>3500)remotePlayers.delete(id);
  }
}
function mpDrawRemote(ctx){
  for(const p of remotePlayers.values()){
    const a=Math.atan2(p.aimY-p.y,p.aimX-p.x);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.globalAlpha=.9;
    ctx.shadowBlur=16;ctx.shadowColor="#b5e7ff";
    ctx.fillStyle="#7bd4ef";
    ctx.beginPath();ctx.arc(0,-8,7,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle="#496b78";
    ctx.beginPath();ctx.roundRect(-8,0,16,20,6);ctx.fill();
    ctx.strokeStyle="#c8f2ff";ctx.lineWidth=5;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(-5,5);ctx.lineTo(5,7);ctx.stroke();
    ctx.save();ctx.rotate(a);
    ctx.fillStyle="#26353c";ctx.fillRect(4,3,28,6);
    ctx.fillStyle="#9eeeff";ctx.fillRect(29,4,4,4);
    ctx.restore();
    ctx.fillStyle="#e8fbff";
    ctx.font="900 9px system-ui,sans-serif";
    ctx.textAlign="center";
    ctx.fillText(p.name||"PLAYER",0,-24);
    ctx.restore();
  }
}
window.NightfallMP={
  host:mpHostRoom,join:mpJoinRoom,leave:mpLeave,tick:mpTick,drawRemote:mpDrawRemote,
  get enabled(){return mpConnected},get room(){return mpRoom},get isHost(){return mpHost}
};
