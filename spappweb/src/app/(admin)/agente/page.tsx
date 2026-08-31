import { PageHeader } from "@/components/layout/page-header";
import { AgentChat } from "@/components/agente/agent-chat";

export default function AgentePage() {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 sm:min-h-[calc(100dvh-10rem)]">
      <PageHeader
        title="Agente IA"
        description="Revisa solicitudes y pregunta a Hermes desde el mismo chat."
      />
      <AgentChat />
    </div>
  );
}
