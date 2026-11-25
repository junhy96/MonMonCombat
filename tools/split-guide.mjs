// 분열 보스 공략 창 목업 — data/dungeons/split-boss/guide.json → docs/split-guide/index.html
// 게임 보스 공략 창(공략 정보 · 보스 스킬 탭, 초반/중반/후반 공략 포인트, 필요한 효과, 종족 강점)과 같은 구성.
// 문구를 고칠 때는 guide.json 만 고치고 다시 실행: node tools/split-guide.mjs
// 몬몬 아이콘: docs/split-guide/icons (data/monmon/art 를 112px 로 줄인 것, icons/meta.json 에 등급·속성)
import { readFileSync, writeFileSync } from 'node:fs';
import { SKILL_ICONS, RACE_ICON } from './split-guide-icons.mjs';

const guide = JSON.parse(readFileSync('data/dungeons/split-boss/guide.json', 'utf8'));
const meta = JSON.parse(readFileSync('docs/split-guide/icons/meta.json', 'utf8'));
const data = JSON.stringify({ guide, meta, icons: SKILL_ICONS }).replace(/</g, '\\u003c');

const html = `<title>쿼디 보스 공략</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap">
<style>
  /* 게임 보스 공략 창을 그대로 옮긴 단일 테마(어두운 남색) 목업 */
  :root {
    color-scheme: dark;
    --page: #0b0f1c; --frame: #f3f5fb; --panel: #161c31; --card: #1c2340; --card-2: #232b4d; --line: #2c3560;
    --text: #f4f6ff; --muted: #9aa3c7; --blue: #4a5cf0; --blue-soft: #8e9cff;
    --orange: #ffb02e; --green: #4fd37a; --red: #ff5d6c; --gold: #f4a521;
    --legend: #f29a1f; --epic: #8b3fd9; --rare: #2f8fe6; --uncommon: #3fbf6a; --common: #7d8597;
    --display: 'Jua', 'Noto Sans KR', system-ui, sans-serif; --body: 'Noto Sans KR', system-ui, sans-serif;
  }
  body { background: var(--page); color: var(--text); font-family: var(--body); }
  .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-block: 20px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  .caption { max-width: 480px; width: 100%; color: var(--muted); font-size: 12.5px; line-height: 1.55; }
  .caption b { color: var(--text); font-weight: 700; }
  .modal { width: 100%; max-width: 480px; background: var(--panel); border: 4px solid var(--frame); border-radius: 22px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.55); }
  .m-head { position: relative; display: flex; justify-content: center; align-items: center; height: 64px; background: #10152a; }
  .m-head h1 { margin: 0; font-family: var(--display); font-size: 26px; font-weight: 400; letter-spacing: .02em; }
  .m-close { position: absolute; right: 14px; top: 12px; width: 40px; height: 40px; border: 0; background: none; cursor: default; }
  .m-close::before, .m-close::after { content: ""; position: absolute; left: 6px; top: 18px; width: 28px; height: 6px; background: #fff; border-radius: 3px; box-shadow: 0 0 0 2px #000; }
  .m-close::before { transform: rotate(45deg); } .m-close::after { transform: rotate(-45deg); }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; background: #181f38; margin: 8px 8px 0; border-radius: 10px 10px 0 0; }
  .tab { appearance: none; border: 0; background: none; color: var(--blue-soft); font-family: var(--body); font-weight: 900; font-size: 17px; padding: 16px 0 14px; border-bottom: 4px solid transparent; cursor: pointer; }
  .tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--blue); }
  .tab:focus-visible, .band:focus-visible, .toggle:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .pane { padding: 0 8px 14px; display: flex; flex-direction: column; gap: 14px; }
  .hero { position: relative; aspect-ratio: 2000 / 1116; max-width: 100%; background: #2b2446; overflow: hidden; }
  .hero-img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .hero-meta { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 0 6px; }
  .hero-meta .race { margin-top: 0; }

  .hero-text { position: absolute; left: 22px; top: 52px; z-index: 1; display: flex; flex-direction: column; gap: 4px; }
  .boss-name { font-family: var(--display); font-size: 40px; line-height: 1; -webkit-text-stroke: 1.5px #2a2a2a; paint-order: stroke fill; text-shadow: 0 3px 0 #1a1a1a; }
  .boss-island { color: #d7c9ff; font-weight: 700; font-size: 15px; }
  .race { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .race-badge { width: 46px; height: 52px; background: #3c4a6b; border: 3px solid #1b2133; clip-path: polygon(50% 0, 100% 18%, 100% 72%, 50% 100%, 0 72%, 0 18%); display: grid; place-items: center; font-size: 22px; }
  .race small { display: block; color: var(--muted); font-size: 12px; }
  .race strong { font-family: var(--display); font-size: 24px; font-weight: 400; }
  .hero svg { position: absolute; right: -6px; bottom: 6px; width: 230px; height: 190px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 20px; }
  .intro-label { color: var(--orange); font-weight: 700; font-size: 14px; margin: 0 0 8px; }
  .intro { margin: 0; font-weight: 700; font-size: 17px; line-height: 1.65; }
  .sec-title { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 16px; border-bottom: 2px solid var(--line); }
  .sec-title h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 23px; }
  .sec-ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; font-weight: 900; }
  .ico-target { border: 2px solid var(--blue); color: var(--blue-soft); }
  .ico-plus { border: 2px solid var(--green); color: var(--green); font-size: 24px; }
  .ico-race { background: #1fb7a5; color: #fff; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
  .bands { display: grid; gap: 10px; margin-bottom: 14px; }
  .band { position: relative; appearance: none; border: 2px solid var(--line); background: #141a30; color: var(--text); border-radius: 14px; padding: 12px 6px 10px; cursor: pointer; font-family: var(--body); }
  .band b { display: block; font-size: 18px; font-weight: 900; } .band span { font-size: 14px; font-weight: 700; color: var(--muted); }
  .band[aria-pressed="true"] { background: var(--blue); border-color: #8fa0ff; } .band[aria-pressed="true"] span { color: #e3e7ff; }
  .band .mine { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--gold); color: #3b2300; font-size: 11px; font-weight: 900; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .pill { display: inline-block; font-weight: 900; font-size: 13.5px; padding: 6px 12px; border-radius: 10px; margin-bottom: 10px; }
  .pill-red { color: var(--red); background: rgba(255,93,108,.12); border: 2px solid var(--red); }
  .pill-green { color: var(--green); background: rgba(79,211,122,.12); border: 2px solid var(--green); }
  .bullets { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .bullets li { position: relative; padding-left: 18px; font-weight: 700; font-size: 15.5px; line-height: 1.6; }
  .bullets li::before { content: ""; position: absolute; left: 2px; top: .66em; width: 7px; height: 7px; border-radius: 50%; background: var(--red); }
  .bullets.solve li::before { background: var(--green); }
  .divider { height: 2px; background: var(--line); margin: 14px 0; border: 0; }
  .need { background: #1a2140; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; margin-top: 12px; }
  .need-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #1e2b3a; }
  .need-num { width: 34px; height: 34px; border-radius: 50%; background: var(--green); color: #0b2414; display: grid; place-items: center; font-weight: 900; flex: none; }
  .need-title { font-weight: 900; font-size: 16px; }
  .need-desc { padding: 14px 16px; font-weight: 700; font-size: 14.5px; line-height: 1.6; color: #d9def5; border-bottom: 1px solid var(--line); }
  .mons { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px; padding: 14px 16px 6px; }
  .mon { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .mon-frame { position: relative; width: 70px; height: 70px; border-radius: 12px; border: 3px solid #0d1120; box-shadow: inset 0 -5px 0 rgba(0,0,0,.25); overflow: hidden; }
  .mon-frame img { width: 100%; height: 100%; object-fit: contain; }
  .mon-name { font-size: 12px; font-weight: 700; color: #d9def5; }
  .mon-grade { font-size: 10.5px; color: var(--muted); }
  .g-전설 { background: var(--legend); } .g-에픽 { background: var(--epic); } .g-레어 { background: var(--rare); } .g-고급 { background: var(--uncommon); } .g-일반 { background: var(--common); }
  .go { margin: 10px 16px 16px; display: flex; align-items: center; gap: 10px; background: #19b6ea; color: #fff; border: 3px solid #0c1a2c; border-radius: 12px; padding: 10px 14px; font-family: var(--display); font-size: 18px; }
  .go .cnt { margin-left: auto; background: #18a44b; border-radius: 8px; padding: 2px 12px; font-family: var(--body); font-weight: 900; font-size: 15px; }
  .race-note { font-weight: 700; font-size: 15px; line-height: 1.6; margin: 0; }
  .sk-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 4px 4px; }
  .sk-head h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 26px; }
  .toggle { display: flex; align-items: center; gap: 10px; background: none; border: 0; color: var(--text); font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
  .sw { width: 50px; height: 28px; border-radius: 999px; background: var(--blue); position: relative; }
  .sw::after { content: ""; position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: right .15s; }
  .toggle[aria-pressed="false"] .sw { background: #3a4266; } .toggle[aria-pressed="false"] .sw::after { right: 26px; }
  .skill { display: grid; grid-template-columns: 64px 1fr; gap: 6px 14px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .sk-img { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #0d1120; object-fit: cover; box-shadow: 0 0 0 2px #8b4fd9; }
  .sk-lockwrap { position: relative; width: 64px; height: 64px; }
  .sk-lock { position: absolute; right: -4px; bottom: -4px; width: 26px; height: 26px; border-radius: 50%; background: #2b3045; border: 2px solid #0d1120; display: grid; place-items: center; }
  .sk-unlock { display: inline-block; margin-left: 6px; font-size: 11.5px; font-weight: 900; color: #3b2300; background: var(--gold); border-radius: 999px; padding: 1px 8px; vertical-align: 2px; }
  .sk-ico { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; border: 3px solid #0d1120; font-family: var(--display); font-size: 26px; color: #fff; }
  .k-기본공격 { background: radial-gradient(circle at 35% 30%, #7fd4ff, #1b6fb8); }
  .k-스킬 { background: radial-gradient(circle at 35% 30%, #c39bff, #5b2fb0); }
  .k-패시브 { background: radial-gradient(circle at 35% 30%, #8ef0c6, #1d8a6b); }
  .sk-name { font-weight: 900; font-size: 18px; }
  .sk-kind { font-weight: 700; font-size: 13.5px; color: var(--blue-soft); }
  .sk-kind.p { color: #6fe0b0; } .sk-kind.b { color: var(--muted); }
  .sk-desc { grid-column: 1 / -1; margin: 6px 0 0; font-weight: 700; font-size: 15px; line-height: 1.65; }
  .t-key { color: var(--orange); } .t-boss { color: var(--green); } .t-bad { color: var(--red); }
  .t-key, .t-boss, .t-bad { white-space: nowrap; }
  .skill .t-key, .skill .t-boss, .skill .t-bad { border: 1.5px solid currentColor; border-radius: 4px; padding: 0 2px; }
  .skills { display: flex; flex-direction: column; gap: 12px; }
  [hidden] { display: none !important; }
  @media (max-width: 420px) { .boss-name { font-size: 34px; } .intro { font-size: 16px; } }
  @media (prefers-reduced-motion: no-preference) { .blob { animation: bob 3.2s ease-in-out infinite; transform-origin: center bottom; } .blob.b2 { animation-delay: -.8s; } .blob.b3 { animation-delay: -1.6s; } .blob.b4 { animation-delay: -2.4s; } }
  @keyframes bob { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(1.03); } }
</style>

<div class="wrap">
  <p class="caption"><b>문항 2 · 분열 보스 공략 창 초안</b> — 게임 보스 공략 창과 같은 구성이에요. 이름·문구는 가칭이고, 고칠 때는 <b>data/dungeons/split-boss/guide.json</b>을 바꾼 뒤 <b>node tools/split-guide.mjs</b>로 다시 만들어요.</p>
  <div class="modal" role="dialog" aria-labelledby="mtitle">
    <div class="m-head"><h1 id="mtitle">보스 공략</h1><button class="m-close" type="button" aria-label="닫기 (목업)"></button></div>
    <div class="tabs" role="tablist">
      <button class="tab" id="tab-info" role="tab" aria-selected="true" aria-controls="pane-info" type="button">공략 정보</button>
      <button class="tab" id="tab-skill" role="tab" aria-selected="false" aria-controls="pane-skill" type="button">보스 스킬</button>
    </div>

    <div class="pane" id="pane-info" role="tabpanel" aria-labelledby="tab-info">
      <div class="hero">
        <img class="hero-img" src="art/boss-banner.jpg" alt="쿼디 보스 그림 — 왕관을 쓴 보라색 젤리와 작은 조각들">
      </div>
      <div class="hero-meta">
        <div><div class="boss-name" id="bossName"></div><div class="boss-island" id="bossIsland"></div></div>
        <div class="race"><div class="race-badge" aria-hidden="true"><svg viewBox="0 0 64 64" width="34" height="34">${RACE_ICON}</svg></div><div><small>종족</small><strong id="bossRace"></strong></div></div>
      </div>
      <div class="card"><p class="intro-label">이 보스는</p><p class="intro" id="intro"></p></div>

      <div class="card">
        <div class="sec-title"><div class="sec-ico ico-target" aria-hidden="true">◎</div><h2>공략 포인트</h2></div>
        <div class="bands" id="bands"></div>
        <div class="card" style="background:#141a30">
          <span class="pill pill-red">보스 패턴</span>
          <ul class="bullets" id="pattern"></ul>
          <hr class="divider">
          <span class="pill pill-green">이렇게 풀어요</span>
          <ul class="bullets solve" id="solve"></ul>
        </div>
      </div>

      <div class="card">
        <div class="sec-title"><div class="sec-ico ico-plus" aria-hidden="true">+</div><h2>필요한 효과</h2></div>
        <div id="needed"></div>
      </div>

      <div class="card">
        <div class="sec-title"><div class="sec-ico ico-race" aria-hidden="true">↑</div><h2>종족 강점 몬몬</h2></div>
        <p class="race-note" id="raceNote"></p>
      </div>
    </div>

    <div class="pane" id="pane-skill" role="tabpanel" aria-labelledby="tab-skill" hidden>
      <div class="sk-head"><h2 id="skName"></h2><button class="toggle" id="detail" type="button" aria-pressed="true">자세히 보기 <span class="sw" aria-hidden="true"></span></button></div>
      <div class="skills" id="skills"></div>
    </div>
  </div>
</div>

<script type="application/json" id="data">${data}</script>
<script>
(function () {
  const { guide, meta, icons } = JSON.parse(document.getElementById('data').textContent);
  const KEY = ['부활 차단', '피해 반사', '은신', '광역 피해', '다회 피해'];
  const BAD = ['기절', '실명', '침묵', '도발', '속박', '디버프'];
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rich = (s) => esc(s.replace(/\\]\\s+(?=[을를이가은는의에로와과도인으만])/g, ']')).replace(/\\[([^\\]]+)\\]/g, (m, t) => '<span class="' + (KEY.includes(t) ? 't-key' : BAD.includes(t) ? 't-bad' : 't-boss') + '">[' + t + ']</span>');
  const $ = (id) => document.getElementById(id);
  $('bossName').textContent = guide.name; $('bossIsland').textContent = guide.island; $('bossRace').textContent = guide.race; $('skName').textContent = guide.name;
  $('intro').innerHTML = rich(guide.intro);
  $('raceNote').innerHTML = rich(guide.raceNote);

  const bandsEl = $('bands');
  bandsEl.style.gridTemplateColumns = 'repeat(' + guide.bands.length + ', 1fr)';
  function showBand(i) {
    bandsEl.querySelectorAll('.band').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    $('pattern').innerHTML = guide.bands[i].pattern.map((p) => '<li>' + rich(p) + '</li>').join('');
    $('solve').innerHTML = guide.bands[i].solve.map((p) => '<li>' + rich(p) + '</li>').join('');
  }
  guide.bands.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'band';
    btn.innerHTML = (i === 1 ? '<span class="mine">내 구간</span>' : '') + '<b>' + esc(b.label) + '</b><span>' + esc(b.range) + '</span>';
    btn.addEventListener('click', () => showBand(i));
    bandsEl.appendChild(btn);
  });
  showBand(1);

  $('needed').innerHTML = guide.needed.map((n, i) => {
    const mons = n.monmon.map((name) => {
      const m = meta[name] || {};
      return '<div class="mon"><div class="mon-frame g-' + esc(m.grade || '일반') + '">' + (m.icon ? '<img src="' + esc(m.icon) + '" alt="">' : '') + '</div><div class="mon-name">' + esc(name) + '</div><div class="mon-grade">' + esc(m.grade || '') + '</div></div>';
    }).join('');
    return '<div class="need"><div class="need-head"><div class="need-num">' + (i + 1) + '</div><div class="need-title">' + rich(n.title) + '</div></div>'
      + '<div class="need-desc">' + rich(n.desc) + '</div><div class="mons">' + mons + '</div>'
      + '<div class="go" aria-hidden="true">▼ 내 몬몬으로 편성하러 가기<span class="cnt">' + n.monmon.length + '</span></div></div>';
  }).join('');

  const KINDS = { '기본공격': 'b', '스킬': '', '패시브': 'p' };
  const ART = { '젤리 몸통박치기': 'art/skill-body.png', '젤리 포탄': 'art/skill-shot.png', '젤리 해일': 'art/skill-wave.png', '사분열': 'art/skill-split.png', '다시 뭉치기': 'art/skill-split.png', '녹지 않는 젤리': 'art/skill-jelly.png' };
  const LOCKED = { '반격 자세': '7단계부터' };
  const LOCK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15"><rect x="5" y="10" width="14" height="10" rx="2" fill="#c9ced9"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#c9ced9" stroke-width="2.4"/></svg>';
  const icoHtml = (s) => {
    const base = ART[s.name] ? '<img class="sk-img" src="' + ART[s.name] + '" alt="">' : '<div class="sk-ico k-' + esc(s.kind) + '">' + (icons[s.name] ? '<svg viewBox="0 0 64 64" width="46" height="46">' + icons[s.name] + '</svg>' : esc(s.name.slice(0, 1))) + '</div>';
    return LOCKED[s.name] ? '<div class="sk-lockwrap" aria-hidden="true">' + base + '<span class="sk-lock">' + LOCK_SVG + '</span></div>' : '<div aria-hidden="true">' + base + '</div>';
  };
  function renderSkills(detail) {
    $('skills').innerHTML = guide.skills.filter((s) => detail || s.kind !== '패시브' || !['절대 면역', '몰아붙이기', '기회'].includes(s.name)).map((s) =>
      '<div class="skill">' + icoHtml(s)
      + '<div><div class="sk-name">' + esc(s.name) + (LOCKED[s.name] ? '<span class="sk-unlock">' + LOCKED[s.name] + '</span>' : '') + '</div><div class="sk-kind ' + KINDS[s.kind] + '">' + esc(s.kind) + '</div></div>'
      + '<p class="sk-desc">' + rich(s.desc) + '</p></div>').join('');
  }
  renderSkills(true);
  $('detail').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); renderSkills(on); });

  const tabs = [['tab-info', 'pane-info'], ['tab-skill', 'pane-skill']];
  const openTab = (t, p) => tabs.forEach(([t2, p2]) => { $(t2).setAttribute('aria-selected', String(t2 === t)); $(p2).hidden = p2 !== p; });
  tabs.forEach(([t, p]) => $(t).addEventListener('click', () => openTab(t, p)));
  if (location.hash === '#boss-skills') openTab('tab-skill', 'pane-skill');
})();
</script>
`;
writeFileSync('docs/split-guide/index.html', html);
console.log('docs/split-guide/index.html', html.length, 'bytes');
