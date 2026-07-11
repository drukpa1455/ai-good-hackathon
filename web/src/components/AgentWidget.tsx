import { useEffect, useRef, useState } from 'react';
import type { PublicRuntimeConfig } from '../contracts';

/**
 * DigitalOcean chatbot boundary. This component ONLY injects the generated
 * widget script with its public data attributes when runtime config is
 * complete and enabled. The widget owns its launcher, history, rendering,
 * transport, and feedback. No custom chat transport, transcript, composer,
 * streaming parser, or proxy exists in this codebase.
 */
export function AgentWidget({ config }: { config: PublicRuntimeConfig | null }) {
  const injectedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const agent = config?.agent;
  const complete = !!(agent?.enabled && agent.script_url && agent.agent_id && agent.chatbot_id);

  useEffect(() => {
    if (!complete || injectedRef.current || !agent) return;
    injectedRef.current = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = agent.script_url!;
    script.setAttribute('data-agent-id', agent.agent_id!);
    script.setAttribute('data-chatbot-id', agent.chatbot_id!);
    script.setAttribute('data-name', agent.name);
    script.setAttribute('data-primary-color', agent.primary_color);
    script.setAttribute('data-secondary-color', agent.secondary_color);
    script.setAttribute('data-button-background-color', agent.button_background_color);
    script.setAttribute('data-starting-message', agent.starting_message);
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);
  }, [complete, agent]);

  if (!config) return null;

  // Widget active: DigitalOcean renders its own launcher into this corner.
  if (complete && !failed) return null;

  // Disabled or failed: non-blocking note; the primary experience is complete
  // without chat.
  return (
    <div
      style={{
        maxWidth: 240,
        border: '1px solid var(--brd)',
        borderRadius: 13,
        background: 'var(--srf)',
        boxShadow: 'var(--shadow)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      role="note"
      aria-label="Agent status"
    >
      <span className="label">{failed ? 'Agent failed to load' : 'Agent unavailable'}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>
        Explore the evidence graph — every claim stays inspectable without chat.
      </span>
    </div>
  );
}
