import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import type { PublicRuntimeConfig } from '../contracts';
import { AgentWidget } from './AgentWidget';

const config: PublicRuntimeConfig = {
  data_mode: 'api',
  agent: {
    enabled: true,
    script_url: 'https://agent.example/static/chatbot/widget.js',
    agent_id: 'agent-id',
    chatbot_id: 'chatbot-id',
    name: 'Groundwork SF',
    starting_message: 'Ask about a demo site.',
    primary_color: '#5b4bc4',
    secondary_color: '#1a1822',
    button_background_color: '#5b4bc4',
  },
};

afterEach(() => {
  document.querySelectorAll<HTMLIFrameElement>('iframe[title="Chatbot Playground"]').forEach((frame) => {
    const placeholder = frame.previousElementSibling;
    if (placeholder instanceof HTMLDivElement && placeholder.style.position === 'fixed') {
      placeholder.remove();
    }
    frame.remove();
  });
  document
    .querySelectorAll(
      'script[src*="/static/chatbot/widget.js"], .groundwork-agent-provider-frame, .groundwork-agent-provider-placeholder',
    )
    .forEach((element) => element.remove());
  vi.useRealTimers();
});

describe('AgentWidget', () => {
  it('injects the complete generated DigitalOcean widget contract', async () => {
    render(<AgentWidget config={config} />);

    const connecting = screen.getByRole('status', { name: 'Agent connecting' });
    expect(connecting).toBeVisible();
    expect(connecting.querySelectorAll('circle')).toHaveLength(55);

    await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://agent.example/static/chatbot/widget.js"]',
      );

      expect(script).not.toBeNull();
      expect(script).toHaveAttribute('data-agent-id', 'agent-id');
      expect(script).toHaveAttribute('data-chatbot-id', 'chatbot-id');
      expect(script).toHaveAttribute('data-name', 'Groundwork SF');
      const logo = script?.getAttribute('data-logo') ?? '';
      expect(logo).toMatch(/^data:image\/svg\+xml,/);
      const logoSvg = decodeURIComponent(logo.slice('data:image/svg+xml,'.length));
      expect(logoSvg.match(/<circle/g)).toHaveLength(55);
      expect(logoSvg).toContain('fill="#afa0ff"');
      expect(logoSvg).not.toContain('stroke=');
      expect(script).toHaveAttribute('data-primary-color', '#5b4bc4');
      expect(script).toHaveAttribute('data-secondary-color', '#1a1822');
      expect(script).toHaveAttribute('data-button-background-color', '#5b4bc4');
      expect(script).toHaveAttribute('data-starting-message', 'Ask about a demo site.');
    });
  });

  it('owns the bounded loading state and trusts only provider frame messages', async () => {
    render(<AgentWidget config={config} />);

    const placeholder = document.createElement('div');
    placeholder.style.position = 'fixed';
    const frame = document.createElement('iframe');
    frame.title = 'Chatbot Playground';
    frame.src = 'https://agent.example/static/chatbot/index.html?config=test';
    document.body.append(placeholder, frame);

    await waitFor(() => {
      expect(frame).toHaveClass('groundwork-agent-provider-frame');
      expect(frame).toHaveAttribute('data-groundwork-state', 'compact');
      expect(placeholder).toHaveClass('groundwork-agent-provider-placeholder');
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://forged.example',
        data: { type: 'chatbot-ready' },
      }),
    );
    expect(screen.getByRole('status', { name: 'Agent connecting' })).toBeVisible();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://agent.example',
        source: window,
        data: { type: 'chatbot-ready' },
      }),
    );
    expect(screen.getByRole('status', { name: 'Agent connecting' })).toBeVisible();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://agent.example',
          source: frame.contentWindow,
          data: { type: 'chatbot-ready' },
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Agent connecting' })).not.toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://agent.example',
          source: frame.contentWindow,
          data: {
            type: 'resize',
            payload: { width: '440px', height: '800px', expanded: false },
          },
        }),
      );
    });
    expect(frame).toHaveAttribute('data-groundwork-state', 'open');

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://agent.example',
          source: frame.contentWindow,
          data: { type: 'resize', payload: { width: '80px', height: '80px' } },
        }),
      );
    });
    expect(frame).toHaveAttribute('data-groundwork-state', 'compact');
  });

  it('falls back when the provider does not become ready within its retry window', () => {
    vi.useFakeTimers();
    const placeholder = document.createElement('div');
    placeholder.style.position = 'fixed';
    const frame = document.createElement('iframe');
    frame.title = 'Chatbot Playground';
    frame.src = 'https://agent.example/static/chatbot/index.html?config=test';
    document.body.append(placeholder, frame);
    render(<AgentWidget config={config} />);

    act(() => vi.advanceTimersByTime(65_000));

    expect(screen.getByRole('note', { name: 'Agent status' })).toHaveTextContent(
      'Agent failed to load',
    );
    expect(placeholder).toHaveClass('groundwork-agent-provider-placeholder');
  });

  it('removes outer-frame presentation decoration on unmount', async () => {
    const view = render(<AgentWidget config={config} />);
    const placeholder = document.createElement('div');
    placeholder.style.position = 'fixed';
    const frame = document.createElement('iframe');
    frame.title = 'Chatbot Playground';
    frame.src = 'https://agent.example/static/chatbot/index.html?config=test';
    document.body.append(placeholder, frame);

    await waitFor(() => expect(frame).toHaveClass('groundwork-agent-provider-frame'));
    view.unmount();

    expect(frame).not.toHaveClass('groundwork-agent-provider-frame');
    expect(frame).not.toHaveAttribute('data-groundwork-state');
    expect(placeholder).not.toHaveClass('groundwork-agent-provider-placeholder');
  });
});
