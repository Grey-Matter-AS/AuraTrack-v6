import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { exportLocalData, mergeRemoteData, compressSDP, decompressSDP } from '../utils/syncHelpers';
import { MAX_SYNC_PAYLOAD_CHARS } from '../utils/importSanitizer';
import { CHUNK_SIZE, MAX_CHUNKS, chunkString, delay, generatePin, waitForWritable } from '../utils/syncTransport';

function appURL(hash) {
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

async function gatherICE(pc) {
  if (pc.iceGatheringState === 'complete') return;
  return new Promise((resolve) => {
    const done = () => { pc.onicecandidate = null; pc.onicegatheringstatechange = null; resolve(); };
    pc.onicecandidate = (ev) => { if (!ev.candidate) done(); };
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') done(); };
    setTimeout(resolve, 4000); // hard timeout
  });
}

async function sdpToQR(sdp, hashPrefix) {
  const compressed = await compressSDP(sdp);
  const url = appURL(`${hashPrefix}${compressed}`);
  return QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: 'L' });
}

// mergeOptions: passed to mergeRemoteData (e.g. { settingsScope: 'all' } to copy device settings too)
export function useLANSync(mergeOptions = {}) {
  const mergeOptionsRef = useRef(mergeOptions);
  useEffect(() => { mergeOptionsRef.current = mergeOptions; });
  const [phase, setPhase] = useState('idle');
  const [offerQR, setOfferQR] = useState(null);
  const [answerQR, setAnswerQR] = useState(null);
  const [pin, setPin] = useState(null);
  const [remotePin, setRemotePin] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isHost, setIsHost] = useState(true);

  const pcRef = useRef(null);
  const chRef = useRef(null);
  const pinRef = useRef(null);
  const verifiedRef = useRef(false);
  const rxRef = useRef({ chunks: [], expected: 0 });
  const phaseRef = useRef('idle');
  const isHostRef = useRef(true);
  const sentLocalRef = useRef(false);

  const go = (p) => { phaseRef.current = p; setPhase(p); };

  const cleanup = useCallback(() => {
    try { chRef.current?.close(); } catch { /* channel already closed */ }
    try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
    chRef.current = null;
    pcRef.current = null;
    verifiedRef.current = false;
    sentLocalRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    go('idle');
    setOfferQR(null); setAnswerQR(null); setPin(null); setRemotePin(null);
    setResult(null); setError(null);
    pinRef.current = null;
    rxRef.current = { chunks: [], expected: 0 };
    isHostRef.current = true;
  }, [cleanup]);

  const sendLocalData = useCallback(async () => {
    try {
      const channel = chRef.current;
      if (!channel || channel.readyState !== 'open') throw new Error('Connection is not ready for sync.');
      const json = JSON.stringify(await exportLocalData());
      const chunks = chunkString(json);
      channel.send(JSON.stringify({ type: 'meta', total: chunks.length }));
      for (let i = 0; i < chunks.length; i += 1) {
        if (!chRef.current || chRef.current.readyState !== 'open') throw new Error('Connection closed during sync.');
        channel.send(JSON.stringify({ type: 'chunk', index: i, data: chunks[i] }));
        if (i < chunks.length - 1) {
          await waitForWritable(channel);
          if (i % 8 === 7) await delay(0);
        }
      }
      sentLocalRef.current = true;
    } catch (err) {
      setError(err.message || 'Sync payload is too large.');
      go('error');
      cleanup();
    }
  }, [cleanup]);

  const onChannelMessage = useCallback(async (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }

    if (data.type === 'pin') {
      pinRef.current = data.pin;
      setRemotePin(data.pin);
      go('pin_confirm');
      return;
    }
    if (data.type === 'pin_ok') {
      if (typeof data.pin !== 'string' || data.pin !== pinRef.current) {
        setError('PIN mismatch. Connection rejected.');
        go('error');
        try { chRef.current?.close(); } catch { /* channel already closed */ }
        try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
        chRef.current = null;
        pcRef.current = null;
        verifiedRef.current = false;
        return;
      }
      verifiedRef.current = true;
      go('transferring');
      await sendLocalData();
      return;
    }
    if (data.type === 'done') {
      go('done');
      cleanup();
      return;
    }
    if (!verifiedRef.current) {
      setError('Unverified connection rejected.');
      go('error');
      try { chRef.current?.close(); } catch { /* channel already closed */ }
      try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
      chRef.current = null;
      pcRef.current = null;
      return;
    }
    if (data.type === 'meta') {
      if (!Number.isInteger(data.total) || data.total < 1 || data.total > MAX_CHUNKS) return;
      rxRef.current = { chunks: new Array(data.total), expected: data.total };
      return;
    }
    if (data.type === 'chunk') {
      if (phaseRef.current !== 'transferring' && phaseRef.current !== 'merging') return;
      if (!Number.isInteger(data.index) || data.index < 0 || data.index >= rxRef.current.expected) return;
      if (typeof data.data !== 'string' || data.data.length > CHUNK_SIZE) return;
      rxRef.current.chunks[data.index] = data.data;
      const filled = rxRef.current.chunks.filter(c => c !== undefined).length;
      if (filled === rxRef.current.expected) {
        try {
          go('merging');
          const payload = rxRef.current.chunks.join('');
          if (payload.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('Received data is too large.');
          const r = await mergeRemoteData(JSON.parse(payload), mergeOptionsRef.current);
          setResult(r);
          if (isHostRef.current) {
            chRef.current?.send(JSON.stringify({ type: 'done' }));
            go('done');
            cleanup();
          } else if (!sentLocalRef.current) {
            go('transferring');
            await sendLocalData();
          }
        } catch {
          setError('Received data could not be parsed.');
          go('error');
          cleanup();
        }
      }
    }
  }, [cleanup, sendLocalData]);

  const wireChannel = useCallback((ch, host) => {
    chRef.current = ch;
    ch.onmessage = onChannelMessage;
    ch.onopen = () => {
      if (host) {
        go('pin_confirm');
        ch.send(JSON.stringify({ type: 'pin', pin: pinRef.current }));
      }
    };
    ch.onclose = () => {
      if (phaseRef.current !== 'done' && phaseRef.current !== 'error') {
        setError('Connection closed unexpectedly.');
        go('error');
      }
    };
  }, [onChannelMessage]);

  const startAsHost = useCallback(async () => {
    setIsHost(true);
    isHostRef.current = true;
    go('generating_offer');
    const newPin = generatePin();
    pinRef.current = newPin;
    verifiedRef.current = false;
    setPin(newPin);
    try {
      const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all' });
      pcRef.current = pc;
      wireChannel(pc.createDataChannel('sync', { ordered: true }), true);

      await pc.setLocalDescription(await pc.createOffer());
      await gatherICE(pc);

      setOfferQR(await sdpToQR(pc.localDescription.sdp, '#sdp='));
      go('waiting_scan');

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Direct connection failed. Make sure both devices are on the same WiFi network.');
          go('error');
          cleanup();
        }
      };
    } catch (e) {
      setError(e.message || 'Failed to generate connection code.');
      go('error');
    }
  }, [cleanup, wireChannel]);

  const startAsGuest = useCallback(async (encodedOffer) => {
    setIsHost(false);
    isHostRef.current = false;
    go('generating_answer');
    verifiedRef.current = false;
    try {
      const offerSDP = await decompressSDP(encodedOffer);
      const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all' });
      pcRef.current = pc;
      pc.ondatachannel = (ev) => wireChannel(ev.channel, false);

      await pc.setRemoteDescription({ type: 'offer', sdp: offerSDP });
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherICE(pc);

      setAnswerQR(await sdpToQR(pc.localDescription.sdp, '#sdp-answer='));
      go('waiting_answer');
    } catch (e) {
      setError(e.message || 'Failed to process connection code.');
      go('error');
    }
  }, [wireChannel]);

  const applyAnswer = useCallback(async (encodedAnswer) => {
    try {
      await pcRef.current.setRemoteDescription({
        type: 'answer',
        sdp: await decompressSDP(encodedAnswer),
      });
      go('connecting');
    } catch {
      setError('Invalid answer QR code.');
      go('error');
    }
  }, []);

  const confirmPin = useCallback(async () => {
    if (!chRef.current || typeof pinRef.current !== 'string') return;
    verifiedRef.current = true;
    chRef.current.send(JSON.stringify({ type: 'pin_ok', pin: pinRef.current }));
    go('transferring');
  }, []);

  return {
    phase, offerQR, answerQR, pin, remotePin, result, error, isHost,
    startAsHost, startAsGuest, applyAnswer, confirmPin, reset,
  };
}
