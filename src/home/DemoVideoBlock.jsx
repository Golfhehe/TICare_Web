import React from 'react';
import { PlayCircle } from 'lucide-react';
import { parseDemoVideo } from './demoVideo';

export default function DemoVideo({ url = import.meta.env.VITE_DEMO_VIDEO_URL }) {
  const v = parseDemoVideo(url);
  return (
    <section className="panel home-video" aria-labelledby="home-video-title">
      <h2 id="home-video-title"><PlayCircle size={20} /> Video minh hoạ</h2>
      {v?.kind === 'file' && <video className="home-video-frame" controls preload="none" src={v.src} aria-label="Video minh hoạ TICare" />}
      {v?.kind === 'youtube' && <iframe className="home-video-frame" src={v.src} title="Video minh hoạ TICare" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
      {!v && <div className="home-video-frame home-video-empty" role="note"><PlayCircle size={34} /><b>Video minh hoạ đang được chuẩn bị</b><small>Video giới thiệu quy trình sử dụng sẽ được bổ sung tại đây.</small></div>}
    </section>
  );
}
