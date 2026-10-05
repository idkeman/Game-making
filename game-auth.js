(()=>{"use strict";
const URL="https://dkwmkvruzebnqlmvwzhy.supabase.co",KEY="sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P";
let client=null,user=null,profile=null,signup=false;
const $=id=>document.getElementById(id);
function inject(){if($("accountButton"))return;
const b=document.createElement("button");b.id="accountButton";b.textContent="Log In";document.body.append(b);
const o=document.createElement("div");o.id="authModal";o.className="auth-modal";
o.innerHTML='<div class="auth-box"><h2 id="authTitle">Log In</h2><p id="authSub">Optional account — you can play without logging in.</p><div id="authForm"><input id="authUsername" maxlength="24" placeholder="Username" style="display:none"><input id="authEmail" type="email" placeholder="Email"><input id="authPassword" type="password" placeholder="Password"><div id="authError" class="auth-error"></div><div class="auth-actions"><button id="authSubmit" class="primary">Log In</button><button id="authToggle">Create account</button><button id="authClose">Close</button></div><button id="authForgot">Forgot password?</button></div><div id="accountForm" style="display:none"><p>Logged in as <strong id="accountEmail"></strong></p><div id="adminStatus" class="admin-status" style="display:none">ADMIN ACCESS · ALL SURVIVORS UNLOCKED</div><label>Username</label><input id="newUsername" maxlength="24" placeholder="Username"><div id="accountError" class="auth-error"></div><div class="auth-account-actions"><button id="saveUsername" class="primary">Save username</button><button id="logoutBtn">Log out</button></div><button id="accountClose" class="auth-close-account">Close</button></div></div>';
document.body.append(o)}
function open(){render();$("authModal").classList.add("show")}
function close(){$("authModal").classList.remove("show")}
function err(x){$("authError").textContent=x||""}
function fill(n){n=String(n||"").trim();if(!n)return;try{localStorage.setItem("nightfallUsername",n)}catch{}}
function render(){const logged=!!user,admin=!!profile&&profile.role==="admin";
$("authTitle").textContent=logged?"Account":(signup?"Create Account":"Log In");
$("authSub").textContent=logged?"Customize your Nightfall username.":"Optional account — you can play without logging in.";
$("authForm").style.display=logged?"none":"block";$("accountForm").style.display=logged?"block":"none";
$("authUsername").style.display=signup?"block":"none";$("authSubmit").textContent=signup?"Create Account":"Log In";
$("authToggle").textContent=signup?"Back to login":"Create account";
$("adminStatus").style.display=admin?"block":"none";
if(logged){$("accountEmail").textContent=user.email||"";$("newUsername").value=profile?.username||""}
$("accountButton").textContent=logged?"👤 "+(profile?.username||user.email||"Account"):"Log In"}
function publish(){window.NightfallAuth={user,profile,isAdmin:profile?.role==="admin"};window.dispatchEvent(new CustomEvent("nightfall-auth-state"))}
async function refresh(){if(!client)return;const {data}=await client.auth.getSession();user=data.session?.user||null;profile=null;
if(user){const r=await client.from("profiles").select("username,role,banned,banned_until").eq("id",user.id).maybeSingle();profile=r.data||null;
if(profile?.banned&&(!profile.banned_until||new Date(profile.banned_until)>new Date())){await client.auth.signOut();user=null;profile=null;alert("This account is currently banned.");}
else if(profile?.username)fill(profile.username)}
publish();render()}
async function submit(){err("");const email=$("authEmail").value.trim(),pass=$("authPassword").value;
if(!email||!pass){err("Enter your email and password.");return}
if(signup){const u=$("authUsername").value.trim();if(!u){err("Enter a username.");return}if(pass.length<6){err("Password must be at least 6 characters.");return}
const {data,error}=await client.auth.signUp({email,password:pass,options:{data:{username:u},emailRedirectTo:location.href.split("#")[0]}});
if(error){err(error.message);return}if(data.session){await refresh();close()}else err("Account created. Check your email to verify it, then log in.");
}else{const {error}=await client.auth.signInWithPassword({email,password:pass});if(error){err(error.message);return}await refresh();close()}}
async function save(){const u=$("newUsername").value.trim();$("accountError").textContent="";
if(!u){$("accountError").textContent="Enter a username.";return}
const {data,error}=await client.rpc("update_my_username",{new_username:u});if(error){$("accountError").textContent=error.message;return}fill(data);await refresh()}
async function init(){inject();client=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});if(!client)return;
$("accountButton").onclick=open;$("authClose").onclick=close;$("accountClose").onclick=close;$("authSubmit").onclick=submit;
$("authToggle").onclick=()=>{signup=!signup;err("");render()};$("saveUsername").onclick=save;$("logoutBtn").onclick=async()=>{await client.auth.signOut();close()};
$("authPassword").onkeydown=e=>{if(e.key==="Enter")submit()};$("authForgot").onclick=async()=>{const e=$("authEmail").value.trim();if(!e){err("Enter your email first.");return}
const {error}=await client.auth.resetPasswordForEmail(e,{redirectTo:location.href.split("#")[0]});err(error?"": "Password reset email sent.");if(error)err(error.message)};
await refresh();const saved=localStorage.getItem("nightfallUsername");if(!user&&saved)fill(saved)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init()})();