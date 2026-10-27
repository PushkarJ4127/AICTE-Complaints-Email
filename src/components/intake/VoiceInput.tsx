import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

interface VoiceInputProps {
  /** BCP-47 language code, e.g. hi-IN */
  language: string;
  /** Called with the completed transcription */
  onFinalText: (text: string) => void;
}

const MODEL_ID = 'onnx-community/whisper-tiny';

const WHISPER_LANGUAGES: Record<string, string> = {
  'en-IN': 'english',
  'hi-IN': 'hindi',
  'mr-IN': 'marathi',
  'ta-IN': 'tamil',
  'te-IN': 'telugu',
  'bn-IN': 'bengali',
  'gu-IN': 'gujarati',
  'kn-IN': 'kannada',
  'ml-IN': 'malayalam',
  'pa-IN': 'punjabi',
};

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function loadTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = import('@huggingface/transformers')
      .then(({ env, pipeline }) => {
        env.useBrowserCache = true;
        return pipeline('automatic-speech-recognition', MODEL_ID, { device: 'wasm' });
      })
      .catch((error: unknown) => {
        transcriberPromise = null;
        throw error;
      });
  }
  return transcriberPromise;
}

function trimSilence(audio: Float32Array, sampleRate: number): Float32Array {
  const frameSize = Math.max(1, Math.floor(sampleRate * 0.02));
  const levels: number[] = [];
  let maximumLevel = 0;

  for (let start = 0; start < audio.length; start += frameSize) {
    const end = Math.min(start + frameSize, audio.length);
    let power = 0;
    for (let i = start; i < end; i++) power += audio[i] * audio[i];
    const level = Math.sqrt(power / (end - start));
    levels.push(level);
    maximumLevel = Math.max(maximumLevel, level);
  }

  if (maximumLevel < 0.004) return new Float32Array(0);
  const threshold = Math.max(0.0025, maximumLevel * 0.07);
  const firstSpeechFrame = levels.findIndex((level) => level >= threshold);
  let lastSpeechFrame = levels.length - 1;
  while (lastSpeechFrame >= firstSpeechFrame && levels[lastSpeechFrame] < threshold) lastSpeechFrame--;
  const padding = Math.ceil(sampleRate * 0.25);
  const start = Math.max(0, firstSpeechFrame * frameSize - padding);
  const end = Math.min(audio.length, (lastSpeechFrame + 1) * frameSize + padding);
  return audio.subarray(start, end);
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ language, onFinalText }) => {
  const [supported] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof AudioContext !== 'undefined' &&
      typeof OfflineAudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined' &&
      'audioWorklet' in AudioContext.prototype
  );
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  useEffect(() => {
    return () => {
      sourceRef.current?.disconnect();
      processorRef.current?.disconnect();
      gainRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'Speech added to the grievance details.') return;
    const timeout = window.setTimeout(() => setStatus(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const transcribe = async (recordedAudio: Float32Array, sampleRate: number) => {
    setProcessing(true);
    setStatus('Preparing private, on-device speech recognition. First use downloads the model and may take a while...');
    setError(null);
    let phase: 'resampling' | 'model' | 'transcription' = 'resampling';
    try {
      let audio = trimSilence(recordedAudio, sampleRate);
      if (audio.length === 0) {
        setError('No clear speech was detected. Speak closer to the microphone and try again.');
        setStatus('');
        return;
      }
      if (sampleRate !== 16_000) {
        const offlineContext = new OfflineAudioContext(
          1,
          Math.ceil(recordedAudio.length * 16_000 / sampleRate),
          16_000
        );
        const sourceBuffer = offlineContext.createBuffer(1, recordedAudio.length, sampleRate);
        sourceBuffer.getChannelData(0).set(recordedAudio);
        const source = offlineContext.createBufferSource();
        source.buffer = sourceBuffer;
        source.connect(offlineContext.destination);
        source.start();
        audio = (await offlineContext.startRendering()).getChannelData(0);
      }
      phase = 'model';
      const recognizer = await loadTranscriber();
      setStatus('Transcribing on this device...');
      phase = 'transcription';
      const result = await recognizer(audio, {
        language: WHISPER_LANGUAGES[language],
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const transcript = result.text.trim();
      if (!transcript) {
        setError('No speech was recognized. Try again in a quiet place and speak clearly.');
        setStatus('');
        return;
      }
      onFinalRef.current(transcript);
      setStatus('Speech added to the grievance details.');
    } catch {
      if (phase === 'resampling') {
        setError('Could not prepare the microphone recording. Please try again.');
      } else if (phase === 'model') {
        setError('Could not download the local speech model. Check your internet connection and retry. Your audio was not uploaded.');
      } else {
        setError('Transcription failed on this device. Please try recording again.');
      }
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const start = async () => {
    setError(null);
    setStatus('');
    audioChunksRef.current = [];
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16_000 });
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule('/voice-capture-processor.js');
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(audioContext, 'aicte-voice-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        outputChannelCount: [1],
      });
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        audioChunksRef.current.push(event.data);
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      sourceRef.current = source;
      processorRef.current = processor;
      gainRef.current = silentGain;
      setStarting(false);
      setListening(true);
      setStatus('Listening... speak now, then select Stop & transcribe.');
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone permission was blocked. Allow microphone access in your browser, then try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No microphone was found on this device.');
      } else {
        setError('Could not start the microphone. Check that it is connected and available.');
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
      }
      audioContextRef.current = null;
      setStarting(false);
    }
  };

  const stop = () => {
    const audioContext = audioContextRef.current;
    const sampleRate = audioContext?.sampleRate ?? 16_000;
    sourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    gainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContext && audioContext.state !== 'closed') void audioContext.close();
    audioContextRef.current = null;
    sourceRef.current = null;
    processorRef.current = null;
    gainRef.current = null;
    setListening(false);
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    if (length === 0) {
      setError('No audio was recorded. Please try again.');
      setStatus('');
      return;
    }
    const audio = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    void transcribe(audio, sampleRate);
  };

  if (!supported) {
    return (
      <p className="text-[11px] text-amber-700">
        Voice input is not supported in this browser. Please use a current version of Chrome or Edge, or type your grievance.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={starting || processing}
        className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 border transition disabled:opacity-60 disabled:cursor-wait ${
          listening
            ? 'bg-red-600 text-white border-red-700 animate-pulse'
            : 'bg-white text-[#0b3b60] border-[#0b3b60] hover:bg-slate-50'
        }`}
        aria-pressed={listening}
      >
        {listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        <span>{listening ? 'Stop & transcribe' : starting ? 'Starting microphone...' : processing ? 'Transcribing...' : 'Speak'}</span>
      </button>
      <span className="text-[10px] text-slate-500">
        Speech is transcribed on this device. Internet is needed once to download the local model.
      </span>
      {status && <span className="text-[11px] text-slate-600" aria-live="polite">{status}</span>}
      {error && <span className="text-[11px] text-red-600" role="alert">{error}</span>}
    </div>
  );
};
