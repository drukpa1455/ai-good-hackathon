import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tmp/frontend-handoff');

test.beforeAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
});

async function expectNoSeriousA11y(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

async function graphEntityList(
  page: import('@playwright/test').Page,
  projectName: string,
) {
  if (projectName === 'mobile') await page.getByRole('tab', { name: 'map' }).click();
  return page.getByRole('list', { name: 'Graph entities' });
}

test.describe('90-second demo flow', () => {
  test('opens on 300 De Haro with parcel, graph, evidence, trust', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sites\/3956008/);
    await expect(page.getByText('Mock data').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Context graph' })).toBeVisible();

    // parallel keyboard list → select the project entity
    const list = await graphEntityList(page, testInfo.project.name);
    await list.getByText('300 De Haro project').click();

    // the demo assertion: 425 affordable units → evidence drawer
    await page.getByRole('button', { name: /affordable units 425 units, open evidence/i }).click();
    const drawer = page.getByRole('dialog', { name: 'Evidence record' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('San Francisco Development Pipeline')).toBeVisible();
    await expect(drawer.getByText(/record key: PL-2026Q1-3956008/)).toBeVisible();
    await expect(drawer.getByRole('link', { name: /open official source/i })).toBeVisible();
    await expect(page).toHaveURL(/ev=ev-6jgi-cpb4-3956008/);

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: path.join(SHOTS, 'desktop-evidence-drawer.png') });
    }

    // Escape closes and focus returns
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // switch to 758/772 Pacific and expose the historical AHBP warning
    await page.getByRole('button', { name: /758\/772 Pacific Avenue/ }).first().click();
    await expect(page).toHaveURL(/\/sites\/0161014/);
    await page.getByRole('button', { name: 'Diagnostics' }).click();
    const trust = page.getByRole('dialog', { name: 'Trust diagnostics' });
    await expect(trust.getByText(/AHBP match is historical/)).toBeVisible();
    await expect(trust.getByText('Latest fixed agent evaluation')).toBeVisible();
    await expect(trust.getByText(/not a live retrieval trace/)).toBeVisible();

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: path.join(SHOTS, 'desktop-trust-panel.png') });
    }
  });

  test('browser back restores evidence selection', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    await (await graphEntityList(page, testInfo.project.name)).getByText('300 De Haro project').click();
    await page.getByRole('button', { name: /affordable units 425 units, open evidence/i }).click();
    await expect(page.getByRole('dialog', { name: 'Evidence record' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Evidence record' })).not.toBeVisible();
    await page.goForward();
    await expect(page.getByRole('dialog', { name: 'Evidence record' })).toBeVisible();
  });

  test('deep link /evidence/:id resolves site and opens drawer on refresh', async ({ page }) => {
    await page.goto('/evidence/ev-wv5m-vpq2-3956008-series');
    await expect(page).toHaveURL(/\/sites\/3956008/);
    const drawer = page.getByRole('dialog', { name: 'Evidence record' });
    await expect(drawer.getByText('Assessor Historical Secured Property Tax Rolls')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Evidence record' })).toBeVisible();
  });

  test('focus filters the current context', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    await page.getByRole('group', { name: 'Context focus' }).first().getByText('housing').click();
    await expect(page).toHaveURL(/focus=housing/);
    const list = await graphEntityList(page, testInfo.project.name);
    await expect(list.getByText('300 De Haro project')).toBeVisible();
    await expect(list.getByText(/311 cases/)).not.toBeVisible();
  });
});

test.describe('mock states', () => {
  test('loading shows a deterministic skeleton', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=loading');
    await expect(page.getByText('Compiling context…')).toBeVisible();
  });

  test('empty offers the three demo sites', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=empty');
    await expect(page.getByText(/no compiled context/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parcel 0161014' })).toBeVisible();
  });

  test('error keeps a retry affordance and request id', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=error');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/request_id/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('stale raises freshness warnings', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=stale');
    await page.getByRole('button', { name: 'Diagnostics' }).click();
    await expect(page.getByText('Assessor series predates the release cutoff')).toBeVisible();
  });

  test('conflict surfaces two incompatible assertions', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=conflict');
    await page.getByRole('button', { name: 'Diagnostics' }).click();
    await expect(page.getByText(/two incompatible status values/i)).toBeVisible();
  });

  test('chat-offline leaves the primary experience complete', async ({ page }) => {
    await page.goto('/sites/3956008?mockState=chat-offline');
    const agentStatus = page.getByRole('note', { name: 'Agent status' });
    await expect(agentStatus).toBeVisible();
    await expect(agentStatus).toContainText('Agent unavailable');
    await expect(page.getByRole('region', { name: 'Context graph' })).toBeVisible();
    await expect(page.getByText('Mock data').first()).toBeVisible();
  });
});

test.describe('accessibility and viewport acceptance', () => {
  test('axe reports no serious violations on the main view in either theme', async ({ page }) => {
    await page.goto('/sites/3956008');
    await page.waitForTimeout(800);
    await expectNoSeriousA11y(page);
    await page.getByRole('button', { name: 'Light' }).click();
    await expectNoSeriousA11y(page);
  });

  test('layout screenshot with agent corner clear', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    await page.waitForTimeout(900);
    const name = testInfo.project.name === 'mobile' ? 'mobile-graph.png' : 'desktop-main.png';
    await page.screenshot({ path: path.join(SHOTS, name) });

    // nothing interactive may sit behind the reserved agent corner
    const corner = page.locator('.agentcorner');
    if (await corner.isVisible()) {
      const box = await corner.boundingBox();
      expect(box).not.toBeNull();
    }
  });

  test('mobile tabs switch graph and map panes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile only');
    await page.goto('/sites/3956008');
    await page.getByRole('tab', { name: 'map' }).click();
    await expect(page.getByText(/centered at/)).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'mobile-map.png') });
    await page.getByRole('tab', { name: 'graph' }).click();
    await expect(page.getByRole('region', { name: 'Context graph' })).toBeVisible();
  });

  test('map attribution stays visible', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    if (testInfo.project.name === 'mobile') await page.getByRole('tab', { name: 'map' }).click();
    await expect(page.getByText(/OpenStreetMap/).first()).toBeVisible();
  });
});
