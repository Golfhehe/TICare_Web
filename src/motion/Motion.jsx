import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, BellRing, Camera, CameraOff, Download, RefreshCw, Save, ScanEye, Settings, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { supabase, live } from '../supabase';
import { uid } from '../lib/uid';
import { createDetector, estimatePeriod } from './detector';
import { faceDisplacement, faceLevels, poseDisplacement, poseSnapshot } from './features';
import { CAMERA_LOST_MESSAGE, cameraErrorMessage, loadSavedCamera, openCamera, saveCamera } from './cameraErrors';
import { validateVideoFile } from './videoFile';
import { buildCsv, buildSessionPayload, createSeriesRecorder, formatClock, normalizeEvents, summarize } from './sessionData';
import { ChannelTabs, Disclaimer, EventList, MotionChart } from './MotionChart';
import { renderChartPng, downloadBlob } from './exportPng';
import MotionHistory from './MotionHistory';
import FollowUp from './FollowUp';
import ConsentGate from './ConsentGate';
import { hasMotionConsent, saveMotionConsent } from './consent';
import { buildObservationSummary } from './summaryText';
import {
  DISCLAIMER, FACE_MODEL_URL, MAX_VIDEO_BYTES, MOTION_CHANNELS, POSE_MODEL_URL, SENSITIVITY_DEFAULT, SENSITIVITY_MAX, SENSITIVITY_MIN,
  WASM_URL, channelLabel,
} from './constants';
import './motion.css';

const UI_EVERY_MS = 250;
const CHART_EVERY_MS = 1000;
const AUX_BIN_S = 0.1;

function newSession() {
  return {
    det: null, rec: createSeriesRecorder(), events: [], alerts: 0, prevSnap: null, prevFace: null, lastT: -1, timeBase: 0,
    startPerf: 0, startedAt: Date.now(), source: 'camera', lastModelTs: 0, fpsN: 0, fpsT: 0, fps: 0, lastUi: 0, lastChart: 0,
    lastEventsLen: 0, aux: {}, persons: 0,
  };
}

export default function Motion({ active = true, stopToken = 0, user, notify, openAuth, onRunningChange, onMotionEvent, onAskAssistant, onCreatePlan, onOpenPrivacy }) {
  const video = useRef(null), canvas = useRef(null);
  const models = useRef({ pose: null, face: null, lib: null, draw: null });
  const stream = useRef(null), fileUrl = useRef(null), sched = useRef(null), running = useRef(false), token = useRef(0), busyRef = useRef(false);
  const S = useRef(newSession());
  const cfg = useRef({});

  const [mode, setMode] = useState('live');
  const [isRunning, setRunning] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [lost, setLost] = useState(false);
  const [devices, setDevices] = useState([]), [deviceId, setDeviceId] = useState(() => loadSavedCamera());
  const [sensitivity, setSensitivity] = useState(SENSITIVITY_DEFAULT), [holdSeconds, setHoldSeconds] = useState(2), [cooldownSeconds, setCooldownSeconds] = useState(20);
  const [sound, setSound] = useState(true), [desktopNotice, setDesktopNotice] = useState(false), [showPoints, setShowPoints] = useState(true), [useFace, setUseFace] = useState(true);
  const [banner, setBanner] = useState(null), [flash, setFlash] = useState(false);
  const [ui, setUi] = useState({ elapsed: 0, fps: 0, persons: 0, progress: 0, status: 'Sẵn sàng' });
  const [eventsView, setEventsView] = useState([]), [rowsView, setRowsView] = useState([]), [alertCount, setAlertCount] = useState(0), [aux, setAux] = useState({});
  const [hasData, setHasData] = useState(false), [videoName, setVideoName] = useState('');
  const [chartChannel, setChartChannel] = useState('left');
  const [pendingStart, setPendingStart] = useState(null);
  const [label, setLabel] = useState(''), [note, setNote] = useState(''), [saving, setSaving] = useState(false), [savedId, setSavedId] = useState(null), [historyKey, setHistoryKey] = useState(0);

  cfg.current = { sensitivity, holdSeconds, cooldownSeconds, sound, desktopNotice, showPoints, useFace, onMotionEvent, onRunningChange };

  // ---- helpers -------------------------------------------------------------------------------
  const detector = () => {
    const s = S.current;
    if (!s.det) s.det = createDetector({ sensitivity: cfg.current.sensitivity, holdSeconds: cfg.current.holdSeconds, cooldownSeconds: cfg.current.cooldownSeconds });
    return s.det;
  };
  useEffect(() => { S.current.det?.setOptions({ sensitivity, holdSeconds, cooldownSeconds }); }, [sensitivity, holdSeconds, cooldownSeconds]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices?.();
      if (list) setDevices(list.filter(d => d.kind === 'videoinput'));
    } catch { /* enumerateDevices unavailable */ }
  }, []);
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return undefined;
    const id = setTimeout(refreshDevices, 0);
    md.addEventListener('devicechange', refreshDevices);
    return () => { clearTimeout(id); md.removeEventListener('devicechange', refreshDevices); };
  }, [refreshDevices]);

  function beep() {
    if (!cfg.current.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const a = new Ctx(), o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = 660; g.gain.value = 0.06;
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.25);
      o.onended = () => a.close();
    } catch (e) { console.debug('Âm báo bị trình duyệt chặn', e); }
  }

  const flashTimer = useRef(null);
  function raiseAlert(a) {
    const s = S.current;
    s.alerts++; setAlertCount(s.alerts);
    const chLabel = channelLabel(a.channel);
    const what = a.reason === 'sustained' ? 'cử động kéo dài' : a.count > 1 ? `${a.count} cử động liên tiếp` : 'cử động đột ngột';
    setBanner({ id: uid(), channel: chLabel, what, t: a.t });
    setFlash(true); clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(false), 4000);
    beep();
    if (cfg.current.desktopNotice && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
      try { new Notification('TICare: phát hiện cử động', { body: `${chLabel}: ${what}. ${DISCLAIMER}.` }); } catch { /* ignore */ }
    }
    cfg.current.onMotionEvent?.({ id: uid(), channel: chLabel, detail: `${what} (${formatClock(a.t)})`, time: Date.now(), level: 'warning' });
  }
  useEffect(() => { if (!banner) return undefined; const id = setTimeout(() => setBanner(null), 9000); return () => clearTimeout(id); }, [banner]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  function addEvents(list) {
    for (const e of list) S.current.events.push({ ...e, id: uid() });
  }

  function syncViews(force) {
    const s = S.current, now = performance.now();
    if (s.events.length !== s.lastEventsLen || force) { s.lastEventsLen = s.events.length; setEventsView(s.events.slice()); }
    if (force || now - s.lastChart >= CHART_EVERY_MS) {
      s.lastChart = now;
      setRowsView(s.rec.rows());
      const out = {};
      for (const ch of MOTION_CHANNELS) {
        const bins = s.aux[ch.id];
        if (bins && bins.length >= 17) out[ch.id] = estimatePeriod(bins, cfg.current.sensitivity);
      }
      setAux(out);
    }
  }

  // ---- models --------------------------------------------------------------------------------
  async function ensureModels(wantFace) {
    const m = models.current;
    if (!m.lib) m.lib = await import('@mediapipe/tasks-vision');
    const { PoseLandmarker, FaceLandmarker, FilesetResolver } = m.lib;
    let vision = null;
    const getVision = async () => (vision ||= await FilesetResolver.forVisionTasks(WASM_URL));
    if (!m.pose) {
      m.pose = await PoseLandmarker.createFromOptions(await getVision(), {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
    }
    if (wantFace && !m.face) {
      try {
        m.face = await FaceLandmarker.createFromOptions(await getVision(), {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        });
      } catch (e) { console.warn('Không tải được mô hình khuôn mặt, tiếp tục với tư thế', e); setNotice('Không tải được mô hình khuôn mặt: kênh chớp mắt và cơ mặt tạm tắt.'); }
    }
  }
  useEffect(() => () => {
    for (const k of ['pose', 'face']) { try { models.current[k]?.close(); } catch { /* ignore */ } models.current[k] = null; }
  }, []);

  // ---- run / stop ----------------------------------------------------------------------------
  const halt = useCallback(() => {
    running.current = false;
    const v = video.current;
    if (sched.current) {
      if (sched.current.kind === 'vfc') { try { v?.cancelVideoFrameCallback(sched.current.id); } catch { /* ignore */ } }
      else cancelAnimationFrame(sched.current.id);
      sched.current = null;
    }
    stream.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    stream.current = null;
    if (v) { v.onended = null; v.pause(); v.srcObject = null; v.removeAttribute('src'); v.load(); }
    if (fileUrl.current) { URL.revokeObjectURL(fileUrl.current); fileUrl.current = null; }
  }, []);

  const finish = useCallback((reason) => {
    const wasRunning = running.current;
    token.current++;
    halt();
    if (!wasRunning) { setRunning(false); return; }
    const s = S.current;
    if (s.det) addEvents(s.det.flush());
    setRunning(false); setBanner(null);
    cfg.current.onRunningChange?.(false);
    setHasData(true);
    syncViews(true);
    setUi(u => ({ ...u, fps: 0, persons: 0, progress: reason === 'video' ? 1 : u.progress, elapsed: Math.max(0, Math.round(s.lastT)), status: reason === 'video' ? 'Video đã phát hết, xem kết quả bên dưới' : reason === 'lost' ? 'Camera bị ngắt kết nối' : 'Đã dừng' }));
  }, [halt]);

  const stop = useCallback(() => { finish('stop'); }, [finish]);

  useEffect(() => { if (!active) stop(); }, [active, stop]);                       // leaving the page releases the camera
  useEffect(() => { if (stopToken > 0) stop(); }, [stopToken, stop]);
  useEffect(() => () => { token.current++; halt(); }, [halt]);

  function onFrame(v, now, meta) {
    const s = S.current, m = models.current, c = canvas.current;
    if (!c || !m.pose) return;
    const t = s.source === 'video' ? (meta?.mediaTime ?? v.currentTime) : s.timeBase + (now - s.startPerf) / 1000;
    if (!(t > s.lastT)) return;
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const ts = Math.max(performance.now(), s.lastModelTs + 1);
    s.lastModelTs = ts;
    let pose;
    try { pose = m.pose.detectForVideo(v, ts); } catch (e) { console.debug('Bỏ qua khung hình lỗi', e); return; }
    const pts = pose.landmarks?.[0];
    s.persons = pose.landmarks?.length || 0;
    const { PoseLandmarker, FaceLandmarker } = m.lib;
    if (pts && cfg.current.showPoints) {
      m.draw.drawConnectors(pts, PoseLandmarker.POSE_CONNECTIONS, { color: '#75e4cf', lineWidth: 2 });
      m.draw.drawLandmarks(pts, { color: '#faffff', fillColor: '#0e9e86', radius: 2 });
    }
    let faceRes = null;
    if (cfg.current.useFace && m.face) {
      try {
        faceRes = m.face.detectForVideo(v, ts);
        const fl = faceRes?.faceLandmarks?.[0];
        if (fl && cfg.current.showPoints) for (const part of ['FACE_LANDMARKS_FACE_OVAL', 'FACE_LANDMARKS_LEFT_EYE', 'FACE_LANDMARKS_RIGHT_EYE', 'FACE_LANDMARKS_LIPS']) m.draw.drawConnectors(fl, FaceLandmarker[part], { color: '#7dd3fc', lineWidth: 1 });
      } catch (e) { console.debug('Bỏ qua khung hình khuôn mặt', e); }
    }
    const snap = poseSnapshot(pts, w / h, t);
    const disp = poseDisplacement(s.prevSnap, snap);
    s.prevSnap = snap;
    const levels = faceLevels(faceRes);
    const fd = faceDisplacement(s.prevFace, levels);
    s.prevFace = levels;
    const channels = { ...(disp?.channels || {}), ...fd };
    if (Object.keys(channels).length) {
      const r = detector().push({ t, channels, trunk: disp?.trunk });
      s.rec.add(t, channels);
      for (const [id, val] of Object.entries(channels)) {
        const bins = (s.aux[id] ||= []);
        const k = Math.floor(t / AUX_BIN_S) * AUX_BIN_S;
        if (bins.length && Math.abs(bins[bins.length - 1].t - k) < 1e-6) bins[bins.length - 1].value = Math.max(bins[bins.length - 1].value, val);
        else { bins.push({ t: k, value: val }); while (bins.length && k - bins[0].t > 7) bins.shift(); }
      }
      addEvents(r.events);
      for (const a of r.alerts) raiseAlert(a);
    }
    s.lastT = t;
    s.fpsN++;
    if (now - s.fpsT >= 1000) { s.fps = Math.round((s.fpsN * 1000) / (now - s.fpsT)); s.fpsN = 0; s.fpsT = now; }
    if (now - s.lastUi >= UI_EVERY_MS) {
      s.lastUi = now;
      const dur = v.duration;
      setUi({ elapsed: Math.max(0, Math.round(t)), fps: s.fps, persons: s.persons, progress: s.source === 'video' && dur > 0 ? Math.min(1, v.currentTime / dur) : 0, status: s.persons ? 'Đang quan sát' : 'Đang tìm người trong khung hình' });
      syncViews(false);
    }
  }

  function schedule(v, tk) {
    const alive = () => tk === token.current && running.current;
    if (typeof v.requestVideoFrameCallback === 'function') {
      const cb = (now, meta) => { if (!alive()) return; onFrame(v, now, meta); if (alive()) sched.current = { kind: 'vfc', id: v.requestVideoFrameCallback(cb) }; };
      sched.current = { kind: 'vfc', id: v.requestVideoFrameCallback(cb) };
    } else {
      let last = -1;
      const loop = now => {
        if (!alive()) return;
        if (v.readyState >= 2 && v.currentTime !== last) { last = v.currentTime; onFrame(v, now, { mediaTime: v.currentTime }); }
        if (alive()) sched.current = { kind: 'raf', id: requestAnimationFrame(loop) };
      };
      sched.current = { kind: 'raf', id: requestAnimationFrame(loop) };
    }
  }

  async function start(kind, file, { resume = false } = {}) {
    if (busyRef.current) return;
    if (kind === 'video') {
      const msg = validateVideoFile(file);
      if (msg) { setError(msg); return; }
    }
    const tk = ++token.current;
    halt();
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setLost(false); setBanner(null);
    const prev = S.current;
    if (!resume) {
      S.current = newSession();
      setHasData(false); setSavedId(null); setEventsView([]); setRowsView([]); setAlertCount(0); setAux({});
    } else {
      prev.det?.reset(); prev.prevSnap = null; prev.prevFace = null; prev.aux = {};
    }
    const s = S.current;
    s.source = kind;
    const stale = () => tk !== token.current;
    try {
      await ensureModels(cfg.current.useFace);
      if (stale()) return;
      const v = video.current;
      if (kind === 'video') {
        fileUrl.current = URL.createObjectURL(file);
        v.src = fileUrl.current;
        v.onended = () => finish('video');
        setVideoName(file.name);
      } else {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('x'), { name: 'TypeError' });
        const { stream: st, usedFallback } = await openCamera(navigator.mediaDevices, deviceId);
        if (stale()) { st.getTracks().forEach(t => t.stop()); return; }
        stream.current = st;
        if (usedFallback) { setNotice('Camera đã chọn không còn kết nối. Đang dùng camera mặc định.'); setDeviceId(''); saveCamera(''); }
        st.getVideoTracks().forEach(t => {
          t.onended = () => { if (running.current && S.current.source === 'camera') { setError(CAMERA_LOST_MESSAGE); setLost(true); finish('lost'); } };
        });
        v.srcObject = st;
        refreshDevices();
      }
      await v.play();
      if (stale()) return;
      if (!models.current.draw) models.current.draw = new models.current.lib.DrawingUtils(canvas.current.getContext('2d'));
      s.startedAt = resume ? s.startedAt : Date.now();
      s.startPerf = performance.now(); s.timeBase = resume ? Math.max(0, s.lastT) + 1 : 0; s.fpsT = s.startPerf;
      running.current = true; setRunning(true);
      cfg.current.onRunningChange?.(true);
      setUi(u => ({ ...u, status: 'Đang tìm người trong khung hình', progress: 0 }));
      schedule(v, tk);
    } catch (e) {
      if (!stale()) { halt(); setRunning(false); setError(kind === 'camera' ? cameraErrorMessage(e) : (e?.message || 'Không phát được video này. Hãy thử tệp MP4 (H.264) hoặc WebM.')); }
    } finally { busyRef.current = false; setBusy(false); }
  }

  // Consent gate: first camera/video start on this device must be confirmed (localStorage failure => ask every time).
  function requestStart(kind, file) {
    if (hasMotionConsent()) { start(kind, file); return; }
    setPendingStart({ kind, file });
  }
  function confirmConsent() {
    const p = pendingStart; setPendingStart(null); saveMotionConsent();
    if (p) start(p.kind, p.file);
  }

  function chooseDevice(id) {
    setDeviceId(id); saveCamera(id);
    if (isRunning && S.current.source === 'camera') setTimeout(() => start('camera', null, { resume: true }), 0);
  }
  function switchMode(next) { if (next === mode) return; if (isRunning) stop(); setError(''); setNotice(''); setMode(next); }

  async function enableDesktop() {
    if (!('Notification' in window)) { setError('Trình duyệt không hỗ trợ thông báo hệ thống.'); return; }
    const result = await Notification.requestPermission();
    setDesktopNotice(result === 'granted');
    if (result !== 'granted') setError('Chưa cấp quyền thông báo hệ thống. Cảnh báo trong TICare vẫn hoạt động.');
  }

  // ---- results / save / export ---------------------------------------------------------------
  const sessionMeta = () => ({ label: label.trim(), source: S.current.source === 'video' ? 'video (thử thuật toán)' : 'camera', startedAt: S.current.startedAt });
  function exportCsv() {
    const s = S.current;
    downloadBlob(new Blob([buildCsv({ series: s.rec.rows(), events: normalizeEvents(s.events), meta: sessionMeta() })], { type: 'text/csv;charset=utf-8' }), 'ticare-motion-phien.csv');
  }
  async function exportPng() {
    const s = S.current;
    try {
      const blob = await renderChartPng({ series: s.rec.rows(), events: normalizeEvents(s.events), channel: chartChannel, subtitle: `${label.trim() || 'Phiên chưa đặt mã'} · ${new Date(s.startedAt).toLocaleString('vi-VN')} · ${formatClock(s.lastT)}` });
      downloadBlob(blob, `ticare-bieu-do-${chartChannel}.png`);
    } catch (e) { setError(e.message); }
  }
  async function saveSession() {
    if (!user) { notify?.('Vui lòng đăng nhập để lưu phiên.'); openAuth?.(); return; }
    if (!live) { setError('Chưa cấu hình Supabase, không thể lưu.'); return; }
    const s = S.current;
    setSaving(true); setError('');
    try {
      const payload = buildSessionPayload({
        label, source: s.source, startedAt: s.startedAt, durationS: s.lastT, note,
        settings: { sensitivity, holdSeconds, cooldownSeconds, face: useFace, detector: 'rolling-mad-v1' }, events: s.events, rows: s.rec.rows(),
      });
      const { data, error: err } = await supabase.from('motion_sessions').insert(payload).select('id').single();
      if (err) throw err;
      setSavedId(data.id); setHistoryKey(k => k + 1);
      notify?.('Đã lưu phiên vào lịch sử của bạn.');
    } catch (e) { setError('Không lưu được phiên: ' + e.message); }
    setSaving(false);
  }

  const summary = summarize(eventsView, ui.elapsed);
  const eventsMax = eventsView.length >= 2000;
  const slow = isRunning && ui.fps > 0 && ui.fps < 12;
  const noSignal = !rowsView.length;
  const showResults = !isRunning && hasData;

  return <div className="mi-v2 mi-motion">
    {pendingStart && <ConsentGate onConfirm={confirmConsent} onCancel={() => setPendingStart(null)} onOpenPrivacy={onOpenPrivacy ? () => { setPendingStart(null); onOpenPrivacy(); } : undefined} />}
    <div className="page-heading"><div><div className="eyebrow">MOTION INSIGHT · PHÂN TÍCH CHUYỂN ĐỘNG</div><h1>Không gian quan sát</h1><p>Phân tích tín hiệu ngay trên thiết bị: phát hiện cử động nhanh hoặc lặp lại để giáo viên chú ý. {DISCLAIMER}.</p></div></div>

    <div className="mi-modes" role="tablist" aria-label="Chế độ">
      <button type="button" role="tab" aria-selected={mode === 'live'} className={mode === 'live' ? 'active' : ''} onClick={() => switchMode('live')}><Camera size={16} /> Quan sát trực tiếp</button>
      <button type="button" role="tab" aria-selected={mode === 'video'} className={mode === 'video' ? 'active' : ''} onClick={() => switchMode('video')}><UploadCloud size={16} /> Kiểm thử bằng video</button>
    </div>
    <p className="mi-mode-help">{mode === 'live'
      ? 'Dùng camera laptop hoặc camera USB để theo dõi theo thời gian thực. Khi có cử động nhanh hoặc lặp lại, TICare hiện cảnh báo, phát âm báo và ghi vào danh sách sự kiện. Giữ tab này hiển thị trong lúc quan sát.'
      : 'Chế độ này chỉ để thử thuật toán và độ nhạy trên một video mẫu được phép sử dụng. Không dùng camera và không phải quan sát học sinh thực tế. Nhận MP4 hoặc WebM, tối đa 200 MB.'}</p>

    <div className="mi-v2-top">
      <div className="mi-v2-stat"><span>Trạng thái</span><strong>{isRunning ? (mode === 'video' ? 'Đang chạy video' : 'Đang quan sát') : 'Sẵn sàng'}</strong><small aria-live="polite">{ui.status}</small></div>
      <div className="mi-v2-stat"><span>Thời lượng</span><strong>{formatClock(ui.elapsed)}</strong><small>{isRunning && ui.fps ? `${ui.fps} khung/giây` : 'Phiên hiện tại'}</small></div>
      <div className="mi-v2-stat"><span>Sự kiện / cảnh báo</span><strong>{eventsView.length} / {alertCount}</strong><small>{eventsView.length ? 'Xem danh sách bên dưới' : 'Chưa có sự kiện'}</small></div>
    </div>

    <div className="mi-v2-layout">
      <section className="mi-v2-main">
        <div className="mi-v2-camera">
          <div className="mi-v2-camera-top"><span className={'mi-v2-live ' + (isRunning ? 'on' : '')}><span /> {isRunning ? (mode === 'video' ? 'VIDEO THỬ ĐANG CHẠY' : 'CAMERA ĐANG CHẠY') : 'CHƯA BẬT NGUỒN'}</span><span><ShieldCheck size={14} /> Xử lý cục bộ</span></div>
          <div className={'mi-v2-stage' + (flash ? ' mi-flash' : '')}>
            {!isRunning && <div className="mi-v2-placeholder"><div className="mi-v2-target"><ScanEye size={45} /></div><b>Motion Insight</b><h2>{mode === 'live' ? 'Sẵn sàng quan sát' : 'Sẵn sàng thử video'}</h2><p>{mode === 'live' ? 'Chọn camera rồi bấm Bật camera.' : 'Chọn một video mẫu để chạy thuật toán.'}</p><span>{DISCLAIMER}</span></div>}
            <video ref={video} playsInline muted style={{ display: isRunning ? 'block' : 'none' }} />
            <canvas ref={canvas} style={{ display: isRunning ? 'block' : 'none' }} />
            {isRunning && <div className="mi-v2-stamp"><Activity size={15} /> {ui.persons ? `${ui.persons} người được nhận diện` : 'Đang tìm người trong khung hình'}</div>}
            {banner && <div role="alert" className="mi-v2-alert mi-banner"><div className="mi-v2-alert-icon"><BellRing size={26} /></div><div><strong>PHÁT HIỆN CỬ ĐỘNG · {banner.channel}</strong><p>{banner.what} lúc {formatClock(banner.t)}</p><small>{DISCLAIMER}</small></div><button type="button" onClick={() => setBanner(null)} aria-label="Đóng cảnh báo"><X size={18} /></button></div>}
          </div>
          {mode === 'video' && <div className="mi-progress" role="progressbar" aria-label="Tiến trình video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ui.progress * 100)}><div style={{ width: `${Math.round(ui.progress * 100)}%` }} /><span>{videoName ? `${videoName} · ` : ''}{Math.round(ui.progress * 100)}%</span></div>}
          {error && <div className="mi-v2-error" role="status"><AlertTriangle size={17} />{error}{lost && <button type="button" className="btn btn-primary small" onClick={() => start('camera', null, { resume: true })} disabled={busy}><RefreshCw size={15} /> Kết nối lại</button>}</div>}
          {notice && !error && <div className="mi-v2-error mi-info" role="status">{notice}</div>}
          {slow && <div className="mi-v2-error mi-info" role="status">Máy xử lý chậm ({ui.fps} khung/giây, nên từ 12 trở lên). Hãy đóng bớt ứng dụng khác hoặc tắt phân tích khuôn mặt ở cột bên phải.</div>}
          {mode === 'live' ? <div className="mi-v2-controls">
            <label className="mi-device"><span>Camera</span>
              <select value={deviceId} onChange={e => chooseDevice(e.target.value)} aria-label="Chọn camera">
                <option value="">Camera mặc định</option>
                {devices.filter(d => d.deviceId).map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => requestStart('camera', null)} disabled={busy}>{busy ? 'Đang tải mô hình...' : isRunning ? 'Khởi động lại' : 'Bật camera'} <Camera size={17} /></button>
            {isRunning && <button type="button" className="btn btn-outline" onClick={stop}><CameraOff size={17} /> Dừng</button>}
          </div> : <div className="mi-v2-controls">
            <label className={'mi-v2-upload' + (busy ? ' disabled' : '')}><UploadCloud size={17} /> Chọn video MP4/WebM<input type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) requestStart('video', f); e.target.value = ''; }} /></label>
            {isRunning && <button type="button" className="btn btn-outline" onClick={stop}><CameraOff size={17} /> Dừng</button>}
            <small className="mi-muted">Tối đa {Math.round(MAX_VIDEO_BYTES / 1048576)} MB · video được xử lý tại máy, không tải lên.</small>
          </div>}
        </div>

        {showResults && <section className="mi-v2-panel mi-result" aria-labelledby="mi-result-title">
          <h3 id="mi-result-title"><Activity size={18} /> Kết quả phiên</h3>
          <Disclaimer />
          <dl className="mi-result-grid">
            <div><dt>Thời lượng</dt><dd>{formatClock(ui.elapsed)}</dd></div>
            <div><dt>Sự kiện</dt><dd>{summary.total}</dd></div>
            <div><dt>Cảnh báo</dt><dd>{alertCount}</dd></div>
            <div><dt>Nguồn</dt><dd>{S.current.source === 'video' ? 'Video thử' : 'Camera'}</dd></div>
          </dl>
          {MOTION_CHANNELS.some(ch => summary.byChannel[ch.id]) && <ul className="mi-result-ch">{MOTION_CHANNELS.filter(ch => summary.byChannel[ch.id]).map(ch => <li key={ch.id}><span style={{ background: ch.color }} />{ch.label}: {summary.byChannel[ch.id].count} sự kiện, mạnh nhất {summary.byChannel[ch.id].maxIntensity.toFixed(1)}</li>)}</ul>}
          {noSignal && <p className="mi-warn"><AlertTriangle size={14} /> Không nhận diện được người trong khung hình nên chưa có dữ liệu. Hãy thử video khác (thấy rõ vai, đầu và tay) hoặc ngồi gần camera hơn.</p>}
          {eventsMax && <p className="mi-muted">Đạt giới hạn 2000 sự kiện; khi lưu chỉ giữ các sự kiện mạnh nhất.</p>}
          <div className="mi-save">
            <label htmlFor="mi-label">Mã học sinh <small>(tối đa 60 ký tự)</small></label>
            <input id="mi-label" type="text" maxLength={60} value={label} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: HS-A lớp 2" autoComplete="off" />
            <p className="mi-warn"><AlertTriangle size={14} /> Chỉ nhập mã quy ước. Không nhập họ tên thật hoặc thông tin nhận dạng của học sinh.</p>
            <label htmlFor="mi-note">Ghi chú <small>(tùy chọn)</small></label>
            <textarea id="mi-note" maxLength={2000} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Bối cảnh quan sát, ví dụ: giờ làm bài" />
            <div className="mi-save-actions">
              <button type="button" className="btn btn-primary" onClick={saveSession} disabled={saving || !!savedId || noSignal}><Save size={16} /> {savedId ? 'Đã lưu' : saving ? 'Đang lưu...' : user ? 'Lưu phiên' : 'Đăng nhập để lưu phiên'}</button>
              <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={noSignal}><Download size={16} /> CSV</button>
              <button type="button" className="btn btn-outline" onClick={exportPng} disabled={noSignal}><Download size={16} /> PNG ({channelLabel(chartChannel)})</button>
            </div>
            <FollowUp summary={buildObservationSummary({ events: eventsView, durationS: ui.elapsed })} onAskAssistant={onAskAssistant} onCreatePlan={onCreatePlan} disabled={noSignal} />
          </div>
        </section>}

        <div className="mi-v2-panel">
          <div className="mi-v2-heading"><div><h3><Activity size={18} /> Biểu đồ tín hiệu</h3><p>Mức dịch chuyển lớn nhất mỗi giây (đơn vị: bề rộng vai/khung hình). Vùng tô màu là sự kiện.</p></div></div>
          <ChannelTabs value={chartChannel} onChange={setChartChannel} events={eventsView} />
          <MotionChart series={rowsView} events={eventsView} channel={chartChannel} windowS={isRunning ? 120 : 0} />
          <div className="mi-v2-channels">{MOTION_CHANNELS.map(ch => <div key={ch.id}><span style={{ background: ch.color }} /><label>{ch.label}</label><strong>{eventsView.filter(e => e.channel === ch.id).length} sự kiện</strong>{aux[ch.id] ? <small className="mi-muted" title="Chỉ số phụ: ước lượng chu kỳ cũ, chỉ để tham khảo">phụ ≈ {aux[ch.id]}/phút</small> : null}</div>)}</div>
        </div>

        <div className="mi-v2-panel">
          <div className="mi-v2-heading"><div><h3><BellRing size={18} /> Sự kiện trong phiên</h3><p>Nhóm theo kênh, mới nhất ở trên.</p></div></div>
          <div aria-live="polite"><EventList events={eventsView} /></div>
        </div>

        <MotionHistory user={user} notify={notify} openAuth={openAuth} refreshKey={historyKey} onAskAssistant={onAskAssistant} onCreatePlan={onCreatePlan} />
      </section>

      <aside className="mi-v2-sidebar">
        <div className="mi-v2-panel mi-v2-settings">
          <h3><Settings size={18} /> Cấu hình quan sát</h3>
          <p>Điều chỉnh ngưỡng thử nghiệm, không phải ngưỡng y khoa.</p>
          <div className="mi-v2-setting"><div><label htmlFor="mi-sens">Độ nhạy</label><strong>{sensitivity}</strong></div><input id="mi-sens" type="range" min={SENSITIVITY_MIN} max={SENSITIVITY_MAX} step="5" value={sensitivity} onChange={e => setSensitivity(+e.target.value)} /><small className="mi-muted">Thấp: ít báo nhầm. Cao: bắt được cử động nhỏ hơn nhưng dễ báo do nhiễu hình ảnh.</small></div>
          <div className="mi-v2-setting"><div><label htmlFor="mi-hold">Cửa sổ gộp sự kiện</label><strong>{holdSeconds} giây</strong></div><input id="mi-hold" type="range" min="1" max="10" step="1" value={holdSeconds} onChange={e => setHoldSeconds(+e.target.value)} /></div>
          <div className="mi-v2-setting"><div><label htmlFor="mi-cool">Giãn cách giữa hai lần báo (mỗi kênh)</label><strong>{cooldownSeconds} giây</strong></div><input id="mi-cool" type="range" min="10" max="120" step="5" value={cooldownSeconds} onChange={e => setCooldownSeconds(+e.target.value)} /></div>
          <label className="mi-v2-toggle"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /><span><b>Âm báo</b><small>Phát tiếng ngắn khi có cảnh báo</small></span></label>
          <label className="mi-v2-toggle"><input type="checkbox" checked={desktopNotice} onChange={e => (e.target.checked ? enableDesktop() : setDesktopNotice(false))} /><span><b>Thông báo trình duyệt</b><small>Khi cửa sổ không được chọn, nếu được cấp quyền</small></span></label>
          <label className="mi-v2-toggle"><input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} /><span><b>Hiển thị điểm mốc</b><small>Điểm khớp cơ thể và đường viền mắt</small></span></label>
          <label className="mi-v2-toggle"><input type="checkbox" checked={useFace} onChange={e => setUseFace(e.target.checked)} /><span><b>Phân tích khuôn mặt</b><small>Chớp mắt, cơ mặt. Tắt nếu máy chậm (áp dụng lần bật sau)</small></span></label>
        </div>
        <div className="mi-v2-panel mi-v2-safety"><h3><ShieldCheck size={18} /> Bảo vệ người dùng</h3><p>Camera và video được phân tích trên thiết bị. TICare không lưu video. Phiên lưu chỉ gồm chỉ số tổng hợp, gắn với mã bạn đặt, không gắn tên học sinh. Chỉ sử dụng video được cho phép.</p><p>{DISCLAIMER}.</p></div>
      </aside>
    </div>
  </div>;
}
