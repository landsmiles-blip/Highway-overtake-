function play(c, skill){
  let mass=100;
  for(let g=0; g<c.gates; g++){
    const good=[mass+c.add, mass+c.addBig];
    if(g===c.mulLine) good.push(mass*2);
    const doors=[];
    if(g!==c.mulLine && Math.random()<c.redChance) doors.push(Math.max(10,Math.round(mass*0.5)));
    while(doors.length<3) doors.push(good[Math.floor(Math.random()*good.length)]);
    doors[doors.length-1]=Math.max.apply(null,good);
    mass=Math.round(Math.random()<skill?Math.max.apply(null,doors):doors[Math.floor(Math.random()*3)]);
  }
  return mass;
}
// the wall tightens as the player learns: unloseable, then generous, then real
function needFrac(lv){
  if(lv<=2) return 0.42;
  if(lv<=6) return 0.42 + (lv-2)*0.045;      // 0.465 -> 0.60
  if(lv<=12) return 0.60 + (lv-6)*0.013;     // 0.613 -> 0.678
  return Math.min(0.72, 0.678 + (lv-12)*0.006);
}
const rows=[];
console.log(" lv | gates | +small | +big  |   NEED  | careless | average | skilled | skilled mass | dig");
for(let lv=1; lv<=20; lv++){
  const gates=Math.round(10+Math.min(4,(lv-1)*0.22));
  const A=30*Math.pow(1.20,lv-1);
  const c={ lv, gates, add:Math.round(A/5)*5, addBig:Math.round(A*3.2/5)*5,
            mulLine: lv<=2?-1:Math.round(gates*0.66),
            redChance: lv<=2?0:Math.min(0.45,0.14+lv*0.02) };
  const N=5000;
  let s=0; for(let n=0;n<N;n++) s+=play(c,0.95);
  c.need=Math.max(150, Math.round(s/N*needFrac(lv)/10)*10);
  const r=[];
  [0.45,0.72,0.95].forEach(function(sk){
    let w=0,sm=0; for(let n=0;n<N;n++){const m=play(c,sk); if(m>=c.need)w++; sm+=m;}
    r.push({win:w/N,avg:sm/N});
  });
  rows.push(c);
  console.log(" %s | %s | %s | %s | %s | %s | %s | %s | %s | %s",
    String(lv).padStart(2), String(c.gates).padStart(5),
    String(c.add).padStart(6), String(c.addBig).padStart(5),
    String(c.need).toLocaleString('en-US').padStart(7),
    (r[0].win*100).toFixed(0).padStart(7)+"%", (r[1].win*100).toFixed(0).padStart(6)+"%",
    (r[2].win*100).toFixed(0).padStart(6)+"%",
    Math.round(r[2].avg).toLocaleString('en-US').padStart(12),
    String(Math.round(r[2].avg)).length);
}
console.log("\nNEEDS   =", JSON.stringify(rows.map(r=>r.need)));
console.log("ADD     =", JSON.stringify(rows.map(r=>r.add)));
console.log("ADDBIG  =", JSON.stringify(rows.map(r=>r.addBig)));
console.log("MULLINE =", JSON.stringify(rows.map(r=>r.mulLine)));
