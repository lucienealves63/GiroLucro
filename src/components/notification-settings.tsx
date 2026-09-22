"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { SectionTitle, Toast, useToast } from "@/components/ui";
import { disablePush, enablePush, pushEnabledHere, pushPermission, pushSupported } from "@/lib/push-client";
import { BUSINESS_INFO } from "@/lib/business-info";

/**
 * Ativar/desativar notificações dentro de Configurações.
 *
 * A permissão do navegador só é pedida no clique em "Ativar notificações".
 * Ao desativar, a inscrição é cancelada no navegador **e** removida do
 * servidor (o endpoint deixa de existir para nós).
 */
export function NotificationSettingsSection({
  devices,
  configured,
}: {
  devices: number;
  configured: boolean;
}) {
  const { msg, show } = useToast();
  const [pending, start] = useTransition();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const refresh = async () => {
    setSupported(pushSupported());
    setPermission(pushPermission());
    setEnabled(await pushEnabledHere());
  };

  useEffect(() => {
    // Dentro do efeito só agendamos a leitura; os setState acontecem depois do
    // await, quando o navegador já respondeu (nada de cascata sincrona).
    let cancelled = false;
    void (async () => {
      const supportedNow = pushSupported();
      const permissionNow = pushPermission();
      const enabledNow = await pushEnabledHere();
      if (cancelled) return;
      setSupported(supportedNow);
      setPermission(permissionNow);
      setEnabled(enabledNow);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (on: boolean) => {
    start(async () => {
      const result = on ? await enablePush() : await disablePush();
      if (!result.ok) {
        show(result.reason ?? "Não foi possível alterar as notificações agora.");
        await refresh();
        return;
      }
      show(on ? "Notificações ativadas neste aparelho." : "Notificações desativadas.");
      await refresh();
    });
  };

  return (
    <div>
      <SectionTitle>Notificações</SectionTitle>
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-start gap-3">
          {enabled ? (
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-volt-400" aria-hidden="true" />
          ) : (
            <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-zinc-200">
              {enabled ? "Notificações ativas neste aparelho" : "Notificações desativadas"}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              Lembretes de manutenção por km, metas e fim do período gratuito. Só pedimos a permissão
              do navegador quando você toca em “Ativar” — nunca automaticamente. Você pode desligar a
              qualquer momento, e a inscrição é apagada do nosso servidor.
            </p>
            {devices > 0 && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Aparelhos inscritos nesta conta: <strong className="text-zinc-400">{devices}</strong>
              </p>
            )}
            {permission === "denied" && (
              <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200">
                O navegador está bloqueando notificações para o GiroLucro. Libere nas permissões do
                site para poder ativar de novo.
              </p>
            )}
            {supported === false && (
              <p className="mt-2 text-[11.5px] text-zinc-500">
                Este navegador não suporta notificações push.
              </p>
            )}
            {!configured && (
              <p className="mt-2 text-[11.5px] text-zinc-500">
                As notificações ainda não estão configuradas neste ambiente.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggle(!enabled)}
          disabled={pending || supported === false || (!configured && !enabled)}
          className={
            enabled
              ? "pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] py-3 text-[13px] font-bold text-zinc-300 disabled:opacity-50"
              : "pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3 text-[13px] font-bold text-ink-950 disabled:opacity-50"
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Aplicando..." : enabled ? "Desativar notificações" : "Ativar notificações"}
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Dúvidas sobre o que enviamos? Veja a{" "}
          <a
            href="/privacidade"
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            Política de Privacidade
          </a>{" "}
          ou escreva para {BUSINESS_INFO.supportEmail}.
        </p>
      </div>
      <Toast msg={msg} />
    </div>
  );
}
