import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// jsdom cannot run canvas/WebGL: stub the two rendering libraries at the
// module boundary. Component logic (states, routing, drawer, trust) still
// runs for real.
vi.mock('cytoscape', () => {
  const collection = () => ({
    remove: vi.fn(),
    removeClass: vi.fn(),
    addClass: vi.fn(),
    forEach: vi.fn(),
  });
  const stub = {
    on: vi.fn(),
    add: vi.fn(),
    fit: vi.fn(),
    minZoom: vi.fn(),
    maxZoom: vi.fn(),
    panBy: vi.fn(),
    zoom: vi.fn(() => 1),
    resize: vi.fn(),
    style: vi.fn(),
    destroy: vi.fn(),
    elements: collection,
    nodes: () => [],
    edges: () => [],
    getElementById: () => ({ nonempty: () => false, addClass: vi.fn(), isNode: () => false }),
  };
  return { default: vi.fn(() => stub) };
});

vi.mock('maplibre-gl', () => {
  class Map {
    on() {}
    off() {}
    remove() {}
    addSource() {}
    addLayer() {}
    getSource() {
      return undefined;
    }
    getLayer() {
      return undefined;
    }
    setPaintProperty() {}
    fitBounds() {}
    isStyleLoaded() {
      return false;
    }
  }
  return { default: { Map }, Map };
});
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing and shell', () => {
  it('/ redirects to the default site and renders the shell', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getAllByText(/300 De Haro Street/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Mock data/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: /sites and focus/i })).toBeInTheDocument();
  });

  it('folds the desktop site rail without losing the graph', async () => {
    const user = userEvent.setup();
    renderAt('/sites/3956008?focus=housing');
    await screen.findByRole('region', { name: /context graph/i });

    const nav = screen.getByRole('navigation', { name: /sites and focus/i });
    const content = document.getElementById('site-rail-content');
    expect(content).not.toHaveAttribute('hidden');

    await user.click(within(nav).getByRole('button', { name: /fold sites and focus/i }));
    expect(content).toHaveAttribute('hidden');
    expect(within(nav).getByRole('button', { name: /open sites and focus/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('region', { name: /context graph/i })).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: /open sites and focus/i }));
    expect(content).not.toHaveAttribute('hidden');
  });

  it('exposes graph zoom controls, detail level, and reset announcement', async () => {
    const user = userEvent.setup();
    renderAt('/sites/3956008');
    const controls = await screen.findByRole('group', { name: /graph zoom controls/i });

    expect(within(controls).getByRole('button', { name: /zoom graph in/i })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: /zoom graph out/i })).toBeInTheDocument();
    expect(within(controls).getByText('full')).toBeInTheDocument();

    await user.click(within(controls).getByRole('button', { name: /reset graph view/i }));
    expect(screen.getByText(/graph view reset\. full detail/i)).toBeInTheDocument();
  });

  it('shows four copyable agent questions in Help', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderAt('/sites/3956008');
    await waitFor(() => expect(screen.getAllByText(/300 De Haro Street/i).length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: 'Help' }));
    const help = screen.getByRole('dialog', { name: 'Help' });
    const questions = within(help).getAllByRole('button', { name: /copy suggested question/i });
    expect(questions).toHaveLength(4);

    await user.click(questions[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(within(questions[0]).getByText('Copied')).toBeInTheDocument();
  });

  it('unknown site renders a useful not-found state with the three demo links', async () => {
    renderAt('/sites/0000000');
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: /demo sites/i });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
  });

  it('selecting an entity then a literal assertion opens the evidence drawer', async () => {
    const user = userEvent.setup();
    renderAt('/sites/3956008');
    const list = await screen.findByRole('list', { name: /graph entities/i });
    await user.click(within(list).getByText('300 De Haro project'));
    const row = await screen.findByRole('button', { name: /affordable units 425 units, open evidence/i });
    await user.click(row);
    const drawer = await screen.findByRole('dialog', { name: /evidence record/i });
    expect(within(drawer).getByText(/San Francisco Development Pipeline/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/record key: PL-2026Q1-3956008/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/fixture projection sha256/i)).toBeInTheDocument();
  });

  it('Escape closes the evidence drawer', async () => {
    const user = userEvent.setup();
    renderAt('/sites/3956008?ev=ev-6jgi-cpb4-3956008');
    await screen.findByRole('dialog', { name: /evidence record/i });
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /evidence record/i })).not.toBeInTheDocument(),
    );
  });

  it('/evidence/:id resolves the owning site and opens the drawer', async () => {
    renderAt('/evidence/ev-fizh-zaxt-0161014');
    const drawer = await screen.findByRole('dialog', { name: /evidence record/i });
    expect(
      within(drawer).getByText(/Affordable Housing Bonus Program Eligible Parcels/i),
    ).toBeInTheDocument();
    // site behind the drawer is the Pacific Avenue context
    await waitFor(() =>
      expect(screen.getAllByText(/758\/772 Pacific Avenue/i).length).toBeGreaterThan(0),
    );
  });

  it('unknown evidence renders not-found', async () => {
    renderAt('/evidence/ev-does-not-exist');
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });

  it('trust panel opens with deterministic metrics and the fixed agent evaluation', async () => {
    const user = userEvent.setup();
    renderAt('/sites/3956008');
    const btn = await screen.findByRole('button', { name: /^diagnostics$/i });
    await user.click(btn);
    const panel = await screen.findByRole('dialog', { name: /trust diagnostics/i });
    expect(within(panel).getByText(/latest fixed agent evaluation/i)).toBeInTheDocument();
    expect(within(panel).getByText(/not a live retrieval trace/i)).toBeInTheDocument();
    expect(within(panel).getByText(/citation coverage/i)).toBeInTheDocument();
  });
});
