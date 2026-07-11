import { afterEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';

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
  document.querySelectorAll('script[src*="/static/chatbot/widget.js"]').forEach((script) => {
    script.remove();
  });
});

describe('AgentWidget', () => {
  it('injects the complete generated DigitalOcean widget contract', async () => {
    render(<AgentWidget config={config} />);

    await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://agent.example/static/chatbot/widget.js"]',
      );

      expect(script).not.toBeNull();
      expect(script).toHaveAttribute('data-agent-id', 'agent-id');
      expect(script).toHaveAttribute('data-chatbot-id', 'chatbot-id');
      expect(script).toHaveAttribute('data-name', 'Groundwork SF');
      expect(script).toHaveAttribute('data-logo', '/static/chatbot/icons/default-agent.svg');
      expect(script).toHaveAttribute('data-primary-color', '#5b4bc4');
      expect(script).toHaveAttribute('data-secondary-color', '#1a1822');
      expect(script).toHaveAttribute('data-button-background-color', '#5b4bc4');
      expect(script).toHaveAttribute('data-starting-message', 'Ask about a demo site.');
    });
  });
});
