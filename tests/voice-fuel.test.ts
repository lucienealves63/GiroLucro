import { parseVoiceCommand } from "@/lib/voice-commands";

const STATIONS = [{ label: "Posto Shell Centro" }, { label: "Ipiranga" }];

describe("comando de voz — combustível por posto", () => {
  it("captura litros e mantém o valor", () => {
    const cmd = parseVoiceCommand("combustível 40 reais 7 litros", null, STATIONS);
    expect(cmd.tab).toBe("combustivel");
    expect(cmd.amount).toBe(40);
    expect(cmd.liters).toBe(7);
  });

  it("reconhece o posto já usado e assume a aba de combustível", () => {
    const cmd = parseVoiceCommand("ipiranga 30 reais 5 litros salvar", null, STATIONS);
    expect(cmd.tab).toBe("combustivel");
    expect(cmd.station).toBe("Ipiranga");
    expect(cmd.amount).toBe(30);
    expect(cmd.liters).toBe(5);
    expect(cmd.action).toBe("save");
  });

  it("não inventa posto que o usuário nunca lançou", () => {
    const cmd = parseVoiceCommand("combustível 30 reais no posto fantasma", null, STATIONS);
    expect(cmd.station).toBeUndefined();
  });

  it("sem lista de postos não há posto", () => {
    expect(parseVoiceCommand("combustível 30 ipiranga").station).toBeUndefined();
  });

  it("resumo mostra litros e posto", () => {
    const cmd = parseVoiceCommand("ipiranga 30 reais 5 litros", null, STATIONS);
    expect(cmd.summary).toContain("5 L");
    expect(cmd.summary).toContain("no Ipiranga");
  });

  it("km continua sendo odômetro, não litros", () => {
    const cmd = parseVoiceCommand("combustível 40 reais 12450 km 7 litros", null, STATIONS);
    expect(cmd.km).toBe(12450);
    expect(cmd.liters).toBe(7);
    expect(cmd.amount).toBe(40);
  });
});
