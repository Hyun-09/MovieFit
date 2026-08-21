const API_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

const genres = {
  28:"액션",12:"모험",16:"애니메이션",35:"코미디",80:"범죄",99:"다큐멘터리",
  18:"드라마",10751:"가족",14:"판타지",36:"역사",27:"공포",10402:"음악",
  9648:"미스터리",10749:"로맨스",878:"SF",10770:"TV 영화",53:"스릴러",10752:"전쟁",37:"서부"
};

const taste = {
  genres: new Set(),
  importance: null,
  pace: null,
  mood: null,
  favoriteMovies: []
};

let step = 1;
let token = sessionStorage.getItem("moviefit_tmdb_token") || "";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function api(path, params={}) {
  const qs = new URLSearchParams({language:"ko-KR", ...params});
  return fetch(API_BASE + path + "?" + qs.toString(), {
    headers: {Authorization: `Bearer ${token}`, "Content-Type":"application/json"}
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.status_message || `TMDB API 오류 (${r.status})`);
    return data;
  });
}

function renderGenres(){
  $("#genreChips").innerHTML = Object.entries(genres).map(([id,name]) =>
    `<button class="chip ${taste.genres.has(Number(id))?"selected":""}" data-id="${id}">${name}</button>`
  ).join("");
  $$("#genreChips .chip").forEach(b => b.onclick = () => {
    const id=Number(b.dataset.id);
    if(taste.genres.has(id)) taste.genres.delete(id);
    else if(taste.genres.size < 4) taste.genres.add(id);
    else return;
    renderGenres();
  });
}

function showStep(n){
  step=n;
  $$(".question").forEach(q=>q.classList.toggle("active", Number(q.dataset.step)===n));
  $("#progressBar").style.width = `${n*20}%`;
  $("#prevBtn").classList.toggle("hidden",n===1);
  $("#nextBtn").textContent = n===5 ? "추천 받기" : "다음";
  $("#stepLabel").innerHTML = `<span>02</span> 취향 조사 · ${n}/5`;
}

function validateStep(){
  if(step===1 && taste.genres.size===0){alert("장르를 하나 이상 선택해줘.");return false}
  if(step===2 && !taste.importance){alert("중요한 요소를 선택해줘.");return false}
  if(step===3 && !taste.pace){alert("영화 속도를 선택해줘.");return false}
  if(step===4 && !taste.mood){alert("분위기를 선택해줘.");return false}
  return true;
}

function choiceHandlers(){
  $$(".choice").forEach(btn=>{
    btn.onclick=()=>{
      const parent=btn.closest(".question");
      parent.querySelectorAll(".choice").forEach(x=>x.classList.remove("selected"));
      btn.classList.add("selected");
      const v=btn.dataset.value;
      if(step===2)taste.importance=v;
      if(step===3)taste.pace=v;
      if(step===4)taste.mood=v;
    }
  });
}

async function searchMovies(){
  const q=$("#movieSearchInput").value.trim();
  if(!q)return;
  $("#movieSearchResults").innerHTML="<p class='muted'>검색 중...</p>";
  try{
    const data=await api("/search/movie",{query:q,include_adult:"false",region:"KR"});
    $("#movieSearchResults").innerHTML=data.results.slice(0,5).map(m=>`
      <button class="search-item" data-id="${m.id}">
        <img src="${m.poster_path?IMG+m.poster_path:""}" alt="">
        <div><b>${escapeHtml(m.title||m.original_title)}</b><br><small>${m.release_date?.slice(0,4)||"연도 미상"} · ${m.vote_average?.toFixed(1)||"-"}</small></div>
      </button>`).join("") || "<p class='muted'>검색 결과가 없어.</p>";
    $$("#movieSearchResults .search-item").forEach(b=>b.onclick=()=>selectMovie(Number(b.dataset.id), data.results.find(x=>x.id===Number(b.dataset.id))));
  }catch(e){$("#movieSearchResults").innerHTML=`<p class='muted'>${escapeHtml(e.message)}</p>`}
}

function selectMovie(id,m){
  if(taste.favoriteMovies.some(x=>x.id===id))return;
  if(taste.favoriteMovies.length>=3){alert("좋아하는 영화는 최대 3개까지 선택할 수 있어.");return}
  taste.favoriteMovies.push({id,title:m.title||m.original_title});
  renderSelectedMovies();
}

function renderSelectedMovies(){
  $("#selectedMovies").innerHTML=taste.favoriteMovies.map(m=>`
    <div class="selected-movie">${escapeHtml(m.title)} <button data-id="${m.id}" aria-label="삭제">×</button></div>`).join("");
  $$("#selectedMovies button").forEach(b=>b.onclick=()=>{
    taste.favoriteMovies=taste.favoriteMovies.filter(x=>x.id!==Number(b.dataset.id));
    renderSelectedMovies();
  });
}

async function getMovieProfile(id){
  return api(`/movie/${id}`,{append_to_response:"credits,keywords"});
}

async function collectCandidates(){
  const genreString=[...taste.genres].join("|");
  const discover = await api("/discover/movie",{
    include_adult:"false",
    region:"KR",
    with_genres:genreString || undefined,
    sort_by:"vote_count.desc",
    "vote_count.gte":200,
    page:1
  });
  let candidates = new Map((discover.results||[]).map(m=>[m.id,m]));

  // 좋아하는 영화의 TMDB 추천/유사작을 후보에 추가
  for(const fav of taste.favoriteMovies){
    const [rec,sim] = await Promise.all([
      api(`/movie/${fav.id}/recommendations`,{page:1}),
      api(`/movie/${fav.id}/similar`,{page:1})
    ]);
    [...(rec.results||[]),...(sim.results||[])].forEach(m=>candidates.set(m.id,m));
  }

  return [...candidates.values()].filter(m=>!taste.favoriteMovies.some(f=>f.id===m.id)).slice(0,70);
}

function keywordSet(obj){
  return new Set((obj?.keywords?.keywords||[]).map(k=>k.id));
}
function castSet(obj){
  return new Set((obj?.credits?.cast||[]).slice(0,12).map(p=>p.id));
}

function scoreMovie(m, profiles, favProfiles){
  let score=0, reasons=[];
  const chosenGenres=[...taste.genres];
  const mg=new Set(m.genre_ids||m.genres?.map(g=>g.id)||[]);
  const genreHits=chosenGenres.filter(g=>mg.has(g)).length;
  score += genreHits*16;
  if(genreHits) reasons.push(`${genreHits}개 선호 장르 일치`);

  // 중요 요소에 따른 가중치: 데이터에서 확인 가능한 항목을 사용
  if(taste.importance==="character"){
    const cast=castSet(m);
    const favCast=new Set(favProfiles.flatMap(c=>[...castSet(c)]));
    const hits=[...cast].filter(x=>favCast.has(x)).length;
    score += hits*7;
    if(hits) reasons.push(`좋아한 영화와 배우 ${hits}명 연결`);
  }

  if(taste.importance==="story"){
    const kw=keywordSet(m);
    const favKw=new Set(favProfiles.flatMap(c=>[...keywordSet(c)]));
    const hits=[...kw].filter(x=>favKw.has(x)).length;
    score += hits*5;
    if(hits) reasons.push(`좋아한 영화와 이야기 키워드 ${hits}개 유사`);
  }

  const avg=favProfiles.length ? favProfiles.reduce((a,x)=>a+(x.vote_average||0),0)/favProfiles.length : 7;
  if(m.vote_average>=avg)score+=8;

  // 속도/분위기는 키워드 신호를 활용한 보정
  const text=((m.overview||"")+" "+(m.title||"")).toLowerCase();
  const moodSignals = {
    warm:["family","friendship","love","feel-good","coming of age","가족","우정","사랑"],
    dark:["psychological","crime","murder","dark","thriller","psychology","범죄","살인","심리"],
    epic:["war","battle","space","journey","kingdom","war","전쟁","우주","왕국","모험"],
    quirky:["surreal","absurd","dark comedy","quirky","eccentric","기묘","블랙 코미디"]
  };
  const signals=moodSignals[taste.mood]||[];
  const moodHits=signals.filter(s=>text.includes(s)).length;
  score+=Math.min(moodHits*4,12);
  if(moodHits) reasons.push("선호 분위기와 맞음");

  // 인기도는 너무 강하게 반영하지 않음
  score += Math.min((m.popularity||0)/30,6);

  return {score,reasons};
}

async function recommend(){
  $("#quizCard").classList.add("hidden");
  $("#loadingCard").classList.remove("hidden");
  $("#loadingTitle").textContent="영화 데이터를 분석하는 중...";
  try{
    const favProfiles=await Promise.all(taste.favoriteMovies.map(m=>getMovieProfile(m.id)));
    const raw=await collectCandidates();

    // 상위 후보만 상세정보를 병렬로 가져와 배우/키워드까지 비교
    $("#loadingText").textContent="배우, 키워드, 장르를 비교하고 있습니다.";
    const detailed=await Promise.all(raw.slice(0,30).map(async m=>{
      try{return await getMovieProfile(m.id)}catch{return m}
    }));
    const ranked=detailed.map(m=>{
      const s=scoreMovie(m, m, favProfiles);
      return {...m,match:s.score,reasons:s.reasons};
    }).sort((a,b)=>b.match-a.match).slice(0,12);

    $("#loadingCard").classList.add("hidden");
    renderResults(ranked);
  }catch(e){
    $("#loadingCard").classList.add("hidden");
    $("#quizCard").classList.remove("hidden");
    alert(`추천을 만들지 못했어.\n${e.message}\n\nTMDB 토큰이 정확한지 확인해줘.`);
  }
}

function renderResults(list){
  $("#resultSection").classList.remove("hidden");
  $("#profileText").textContent=`선택한 ${[...taste.genres].length}개 장르와 선호 요소를 중심으로 ${taste.favoriteMovies.length}개의 좋아하는 영화를 참고했습니다.`;
  $("#profileTags").innerHTML=[
    ...[...taste.genres].map(g=>`<span class="profile-tag">${genres[g]}</span>`),
    taste.importance?`<span class="profile-tag">중요: ${({story:"스토리",character:"캐릭터",visual:"영상미",emotion:"감정"})[taste.importance]}</span>`:"",
    taste.pace?`<span class="profile-tag">속도: ${({slow:"느림",balanced:"균형",fast:"빠름"})[taste.pace]}</span>`:"",
    taste.mood?`<span class="profile-tag">분위기: ${({warm:"따뜻함",dark:"어두움",epic:"웅장함",quirky:"독특함"})[taste.mood]}</span>`:""
  ].filter(Boolean).join("");

  $("#movieGrid").innerHTML=list.map((m,i)=>{
    const title=escapeHtml(m.title||m.original_title);
    const overview=escapeHtml(m.overview||"설명이 등록되지 않았습니다.");
    const year=(m.release_date||"").slice(0,4);
    const poster=m.poster_path?IMG+m.poster_path:"";
    return `<article class="movie">
      <img class="movie-poster" src="${poster}" alt="${title} 포스터" onerror="this.style.visibility='hidden'">
      <div class="movie-body">
        <div class="movie-title">${i+1}. ${title}</div>
        <div class="score">취향 적합도 ${Math.min(99,Math.round(m.match))}%</div>
        <div class="meta">${year||"연도 미상"} · ★ ${(m.vote_average||0).toFixed(1)}</div>
        <div class="why">${m.reasons.length?m.reasons.join(" · "):"전체 취향 프로필과 종합적으로 높은 일치도"}</div>
        <div class="why">${overview.slice(0,115)}${overview.length>115?"…":""}</div>
      </div>
    </article>`
  }).join("");
  $("#resultSection").scrollIntoView({behavior:"smooth",block:"start"});
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

$("#saveTokenBtn").onclick=()=>{
  const v=$("#tokenInput").value.trim();
  if(!v){alert("TMDB API Read Access Token을 입력해줘.");return}
  token=v;
  sessionStorage.setItem("moviefit_tmdb_token",token);
  $("#setupCard").classList.add("hidden");
  $("#quizCard").classList.remove("hidden");
  renderGenres();
  showStep(1);
};
$("#nextBtn").onclick=()=>{
  if(!validateStep())return;
  if(step<5)showStep(step+1); else recommend();
};
$("#prevBtn").onclick=()=>showStep(Math.max(1,step-1));
$("#movieSearchBtn").onclick=searchMovies;
$("#movieSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchMovies()});
$("#resetBtn").onclick=()=>{
  $("#resultSection").classList.add("hidden");
  $("#quizCard").classList.remove("hidden");
  step=1;taste.genres.clear();taste.importance=taste.pace=taste.mood=null;taste.favoriteMovies=[];
  renderGenres();renderSelectedMovies();showStep(1);
  $$(".choice").forEach(x=>x.classList.remove("selected"));
};
$("#tokenInput").value = "";
if(token){
  $("#setupCard").classList.add("hidden");
  $("#quizCard").classList.remove("hidden");
  renderGenres();showStep(1);
}
choiceHandlers();
