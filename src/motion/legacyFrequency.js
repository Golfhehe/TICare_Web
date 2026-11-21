// Legacy periodic-oscillation estimator (moved verbatim from App.jsx motionFrequency).
// It estimates the period of REGULAR oscillation at ~10 Hz sampling; it is NOT an event detector.
// Kept only as a secondary metric ("chu kỳ"). See legacyFrequency.test.js for why it misses fast shaking.
export function estimatePeriod(samples, sensitivity=60) {
  if(samples.length<17) return null;
  // Mẫu cách nhau ~100ms, thời gian thực được dùng để tính chu kỳ.
  const values=samples.map(s=>s.value);
  const smoothed=values.map((_,i)=>{
    const a=Math.max(0,i-1),b=Math.min(values.length-1,i+1);
    return values.slice(a,b+1).reduce((x,y)=>x+y,0)/(b-a+1);
  });
  const sorted=[...smoothed].sort((x,y)=>x-y);
  const amp=sorted[Math.floor(sorted.length*.9)]-sorted[Math.floor(sorted.length*.1)];
  const minAmp=.075-(sensitivity/100)*.065; // 0.01 ... 0.075 (tín hiệu chuẩn hóa)
  if(amp<minAmp) return null;
  const avg=smoothed.reduce((x,y)=>x+y,0)/smoothed.length;
  const peaks=[];
  for(let i=2;i<smoothed.length-2;i++) {
    const t=samples[i].t;
    if(smoothed[i]>avg+amp*.13 && smoothed[i]>=smoothed[i-1] && smoothed[i]>smoothed[i+1] &&
      (!peaks.length || t-samples[peaks.at(-1)].t>.38)) peaks.push(i);
  }
  if(peaks.length<3) return null;
  const durations=peaks.slice(1).map((id,j)=>samples[id].t-samples[peaks[j]].t);
  const mean=durations.reduce((x,y)=>x+y,0)/durations.length;
  if(mean<.38||mean>3.2) return null;
  const cv=Math.sqrt(durations.reduce((x,y)=>x+(y-mean)**2,0)/durations.length)/mean;
  if(cv>(.27+sensitivity*.003)) return null;
  return +Math.min(155,60/mean).toFixed(1);
}
