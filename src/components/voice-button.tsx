"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import clsx from "clsx";
import {
  createSpeechRecognition,
  supportsSpeechRecognition,
  type BrowserSpeechRecognition,
} from "@/lib/voice-commands";

type VoiceButtonProps = {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  listeningLabel?: string;
};

export function VoiceButton({
  onTranscript,
  onError,
  disabled,
  className,
  size = "md",
  label = "Falar",
  listeningLabel = "Ouvindo…",
}: VoiceButtonProps) {
  // Avaliado no cliente; no SSR fica false e o botão mostra "indisponível"
  // até a hidratação (suporte real é checado de forma lazy no click também).
  const supported =
    typeof window !== "undefined" ? supportsSpeechRecognition() : false;
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
    setBusy(false);
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    if (!supportsSpeechRecognition()) {
      onErrorRef.current?.(
        "Seu navegador não suporta comando de voz. Use Chrome ou Edge.",
      );
      return;
    }

    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }

    const rec = createSpeechRecognition();
    if (!rec) {
      onErrorRef.current?.("Não foi possível iniciar o microfone.");
      return;
    }
    recRef.current = rec;
    setBusy(true);

    rec.onstart = () => {
      setListening(true);
      setBusy(false);
    };
    rec.onend = () => {
      setListening(false);
      setBusy(false);
    };
    rec.onerror = (ev) => {
      setListening(false);
      setBusy(false);
      const err = ev.error ?? "error";
      if (err === "not-allowed" || err === "service-not-allowed") {
        onErrorRef.current?.(
          "Permissão de microfone negada. Libere nas configurações do navegador.",
        );
      } else if (err === "no-speech") {
        onErrorRef.current?.("Não ouvi nada. Tente de novo.");
      } else if (err !== "aborted") {
        onErrorRef.current?.("Falha no reconhecimento de voz. Tente novamente.");
      }
    };
    rec.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0]?.transcript ?? "";
        if (ev.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      if (finalText.trim()) {
        onTranscriptRef.current(finalText.trim(), true);
      } else if (interim.trim()) {
        onTranscriptRef.current(interim.trim(), false);
      }
    };

    try {
      rec.start();
    } catch {
      setListening(false);
      setBusy(false);
      onErrorRef.current?.("Não foi possível iniciar o microfone.");
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voz não suportada neste navegador"
        className={clsx(
          "pressable inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-zinc-600 opacity-60",
          size === "sm" && "h-10 px-3 text-[12px]",
          size === "md" && "h-12 px-4 text-[13px]",
          size === "lg" && "h-14 px-5 text-[14px]",
          className,
        )}
      >
        <MicOff className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        <span className="font-bold">Voz indisponível</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled || busy}
      aria-pressed={listening}
      aria-label={listening ? "Parar de ouvir" : "Comando de voz"}
      className={clsx(
        "pressable inline-flex items-center justify-center gap-2 rounded-2xl border font-bold transition-colors disabled:opacity-50",
        listening
          ? "border-rose-400/40 bg-rose-400/15 text-rose-300 shadow-[0_0_24px_rgba(251,113,133,0.25)]"
          : "border-volt-400/35 bg-volt-400/[0.08] text-volt-300",
        size === "sm" && "h-10 px-3 text-[12px]",
        size === "md" && "h-12 px-4 text-[13px]",
        size === "lg" && "h-14 w-full px-5 text-[14px]",
        className,
      )}
    >
      {busy ? (
        <Loader2 className={clsx(size === "sm" ? "h-4 w-4" : "h-5 w-5", "animate-spin")} />
      ) : listening ? (
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/40" />
          <Mic className="relative h-5 w-5" strokeWidth={2.4} />
        </span>
      ) : (
        <Mic className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2.4} />
      )}
      <span>{listening ? listeningLabel : label}</span>
    </button>
  );
}
