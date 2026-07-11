import { useEffect, useRef, useState } from 'react';
import type { PublicRuntimeConfig } from '../contracts';
import { BrandMark, brandMarkDataUri } from './BrandMark';

const PROVIDER_FRAME_TITLE = 'Chatbot Playground';
const PROVIDER_TIMEOUT_MS = 65_000;
const AGENT_LOGO_DATA_URI = brandMarkDataUri();

function originOf(scriptUrl: string | null | undefined): string | null {
  if (!scriptUrl) return null;
  try {
    return new URL(scriptUrl).origin;
  } catch {
    return null;
  }
}

function findProviderFrame(origin: string): HTMLIFrameElement | null {
  for (const frame of document.querySelectorAll<HTMLIFrameElement>(
    `iframe[title="${PROVIDER_FRAME_TITLE}"]`,
  )) {
    try {
      const url = new URL(frame.src);
      if (url.origin === origin && url.pathname === '/static/chatbot/index.html') return frame;
    } catch {
      // Ignore unrelated frames with malformed sources.
    }
  }
  return null;
}

function decorateProviderFrame(origin: string): HTMLIFrameElement | null {
  const frame = findProviderFrame(origin);
  if (!frame) return null;
  frame.classList.add('groundwork-agent-provider-frame');
  frame.dataset.groundworkState ||= 'compact';

  const placeholder = frame.previousElementSibling;
  if (placeholder instanceof HTMLDivElement && placeholder.style.position === 'fixed') {
    placeholder.classList.add('groundwork-agent-provider-placeholder');
  }
  return frame;
}

/**
 * DigitalOcean chatbot boundary. This component injects the generated widget
 * script and owns only its bounded outer-frame loading and compact sizing.
 * The cross-origin widget owns the interactive launcher, history, rendering,
 * transport, and feedback. No custom chat transport, transcript, composer,
 * streaming parser, or proxy exists in this codebase.
 */
export function AgentWidget({ config }: { config: PublicRuntimeConfig | null }) {
  const injectedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const agent = config?.agent;
  const providerOrigin = originOf(agent?.script_url);
  const complete = !!(
    agent?.enabled &&
    providerOrigin &&
    agent.script_url &&
    agent.agent_id &&
    agent.chatbot_id
  );

  useEffect(() => {
    if (!complete || !providerOrigin) return;

    let timeoutId = window.setTimeout(() => setFailed(true), PROVIDER_TIMEOUT_MS);
    const decorate = () => decorateProviderFrame(providerOrigin);
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true });
    decorate();

    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== providerOrigin || typeof event.data !== 'object' || !event.data) return;
      const message = event.data as { type?: unknown; payload?: unknown };
      const frame = decorate();
      if (!frame || event.source !== frame.contentWindow) return;

      if (message.type === 'chatbot-ready') {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
        setReady(true);
        return;
      }

      if (message.type !== 'resize' || typeof message.payload !== 'object' || !message.payload) {
        return;
      }
      const payload = message.payload as { width?: unknown; height?: unknown; expanded?: unknown };
      if (payload.width === '80px' && payload.height === '80px') {
        frame.dataset.groundworkState = 'compact';
      } else if (payload.expanded === true) {
        frame.dataset.groundworkState = 'expanded';
      } else if (typeof payload.width === 'string' && typeof payload.height === 'string') {
        frame.dataset.groundworkState = 'open';
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      observer.disconnect();
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeoutId);
      const frame = findProviderFrame(providerOrigin);
      const placeholder = frame?.previousElementSibling;
      frame?.classList.remove('groundwork-agent-provider-frame');
      if (frame) delete frame.dataset.groundworkState;
      placeholder?.classList.remove('groundwork-agent-provider-placeholder');
    };
  }, [complete, providerOrigin]);

  useEffect(() => {
    if (!complete || injectedRef.current || !agent) return;
    injectedRef.current = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = agent.script_url!;
    script.setAttribute('data-agent-id', agent.agent_id!);
    script.setAttribute('data-chatbot-id', agent.chatbot_id!);
    script.setAttribute('data-name', agent.name);
    script.setAttribute('data-logo', AGENT_LOGO_DATA_URI);
    script.setAttribute('data-primary-color', agent.primary_color);
    script.setAttribute('data-secondary-color', agent.secondary_color);
    script.setAttribute('data-button-background-color', agent.button_background_color);
    script.setAttribute('data-starting-message', agent.starting_message);
    script.onerror = () => {
      setReady(false);
      setFailed(true);
    };
    document.body.appendChild(script);
  }, [complete, agent]);

  if (!config) return null;

  if (complete && !failed) {
    // Hide the generated white wake-up placeholder behind a bounded branded
    // state. DigitalOcean renders the interactive launcher once it is ready.
    if (ready) return null;
    return (
      <div className="agentlauncher" role="status" aria-label="Agent connecting">
        <BrandMark size={32} />
        <span className="visually-hidden">Connecting to Groundwork agent…</span>
      </div>
    );
  }

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
