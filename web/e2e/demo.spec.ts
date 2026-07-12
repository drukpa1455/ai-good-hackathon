import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tmp/frontend-handoff');
const DATA_MODE = process.env.PLAYWRIGHT_DATA_MODE ?? 'mock';

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
      await drawer.evaluate(async (element) => {
        await Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
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
  test.skip(DATA_MODE !== 'mock', 'deterministic mock-client states');

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
  test('axe reports no serious violations on the main view in either theme', async ({
    page,
  }, testInfo) => {
    await page.goto('/sites/3956008');
    await page.waitForTimeout(800);
    const graph = page.locator('.graph-host');
    const graphDetail = await graph.evaluate((element) => ({
      lod: element.getAttribute('data-lod'),
      facts: element.getAttribute('data-visible-facts'),
      counts: element.getAttribute('data-visible-count-pills'),
    }));
    await expectNoSeriousA11y(page);
    await page.getByRole('button', { name: 'Light' }).click();
    await expectNoSeriousA11y(page);
    await expect(graph).toHaveAttribute('data-lod', graphDetail.lod!);
    await expect(graph).toHaveAttribute('data-visible-facts', graphDetail.facts!);
    await expect(graph).toHaveAttribute('data-visible-count-pills', graphDetail.counts!);
    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: path.join(SHOTS, 'desktop-main-light.png') });
    }
  });

  test('layout screenshot with agent corner clear', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    await page.waitForTimeout(900);
    const name = testInfo.project.name === 'mobile' ? 'mobile-graph.png' : 'desktop-main.png';
    await page.screenshot({ path: path.join(SHOTS, name) });

    // Keep controls clear of the provider widget's fixed 80px launcher plus 24px inset.
    const viewport = page.viewportSize();
    const diagnostics = page.getByRole('button', { name: 'Diagnostics' });
    const zoomControls = page.getByRole('group', { name: 'Graph zoom controls' });
    const [box, zoomBox] = await Promise.all([
      diagnostics.boundingBox(),
      zoomControls.boundingBox(),
    ]);
    expect(viewport).not.toBeNull();
    expect(box).not.toBeNull();
    expect(zoomBox).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width - 104);
    expect(zoomBox!.x).toBeGreaterThanOrEqual(0);
    expect(zoomBox!.x + zoomBox!.width).toBeLessThanOrEqual(viewport!.width);
    const agentStatus = page.getByRole('note', { name: 'Agent status' });
    if (await agentStatus.isVisible()) {
      const agentBox = await agentStatus.boundingBox();
      expect(agentBox).not.toBeNull();
      const overlaps =
        zoomBox!.x < agentBox!.x + agentBox!.width &&
        zoomBox!.x + zoomBox!.width > agentBox!.x &&
        zoomBox!.y < agentBox!.y + agentBox!.height &&
        zoomBox!.y + zoomBox!.height > agentBox!.y;
      expect(overlaps).toBe(false);
    }
    if (testInfo.project.name === 'mobile') {
      for (const button of await zoomControls.getByRole('button').all()) {
        const target = await button.boundingBox();
        expect(target).not.toBeNull();
        expect(target!.width).toBeGreaterThanOrEqual(44);
        expect(target!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport!.width);
  });

  test('desktop uses the full-bleed corner shell and folding rail', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.goto('/sites/3956008?focus=housing');

    const rail = page.getByRole('navigation', { name: 'Sites and focus' });
    const graph = page.getByRole('region', { name: 'Context graph' });
    const inspector = page.getByRole('region', { name: 'Entities and assertions' });
    const map = page.getByRole('region', { name: 'Parcel map' });
    const [railBox, graphBox, inspectorBox, mapBox] = await Promise.all([
      rail.boundingBox(),
      graph.boundingBox(),
      inspector.boundingBox(),
      map.boundingBox(),
    ]);
    expect(railBox).not.toBeNull();
    expect(graphBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    expect(mapBox).not.toBeNull();
    expect(Math.round(railBox!.width)).toBe(264);
    expect(graphBox!.width).toBeGreaterThan(1100);
    expect(inspectorBox!.x + inspectorBox!.width).toBeLessThan(mapBox!.x);

    await page.getByRole('button', { name: 'Fold sites and focus' }).click();
    await expect.poll(async () => Math.round((await rail.boundingBox())?.width ?? 0)).toBe(46);
    await expect.poll(async () => Math.round((await graph.boundingBox())?.width ?? 0)).toBeGreaterThan(1390);
    await expect(page).toHaveURL(/focus=housing/);
    await expect(page.getByRole('region', { name: 'Context graph' })).toBeVisible();
  });

  test('graph zoom moves full to mid to far, resets, and preserves selected facts', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.goto('/sites/3956008');

    const graph = page.locator('.graph-host');
    const controls = page.getByRole('group', { name: 'Graph zoom controls' });
    const zoomOut = controls.getByRole('button', { name: 'Zoom graph out' });
    const lod = controls.locator('.graph-zoom__lod');

    await expect(graph).toHaveAttribute('data-lod', 'full');
    await expect(lod).toHaveText('full');

    await zoomOut.click();
    await expect(graph).toHaveAttribute('data-lod', 'mid');
    await expect(graph).toHaveAttribute('data-visible-facts', '0');
    await expect(graph).toHaveAttribute('data-visible-count-pills', /^[1-9]\d*$/);

    await zoomOut.click();
    await expect(graph).toHaveAttribute('data-lod', 'far');
    await expect(graph).toHaveAttribute('data-visible-count-pills', '0');

    await controls.getByRole('button', { name: 'Reset graph view' }).click();
    await expect(graph).toHaveAttribute('data-lod', 'full');
    await expect(page.locator('.graphpane [aria-live="polite"]')).toContainText('Graph view reset');

    await page.getByRole('list', { name: 'Graph entities' }).getByText('300 De Haro project').click();
    await zoomOut.click();
    await zoomOut.click();
    await expect(graph).toHaveAttribute('data-lod', 'far');
    await expect(graph).toHaveAttribute('data-selected-subject', /.+/);
    await expect(graph).toHaveAttribute('data-visible-facts', /^[1-9]\d*$/);
    await expect(page.getByLabel('Graph detail summary')).toContainText('selected facts expanded');
  });

  test('Help presents the suggested agent questions and scope', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    await page.getByRole('button', { name: 'Help' }).click();
    const help = page.getByRole('dialog', { name: 'Help' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('button', { name: /copy suggested question/i })).toHaveCount(4);
    await expect(help.getByText(/not a marketplace/i)).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: path.join(SHOTS, 'desktop-help.png') });
    }
  });

  test('mobile tabs switch graph and map panes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile only');
    await page.goto('/sites/3956008');
    await page.getByRole('tab', { name: 'map' }).click();
    await expect(page.getByText(/centered at/)).toBeVisible();
    const mapBox = await page.locator('.mapcard').boundingBox();
    const entitiesBox = await page.getByRole('list', { name: 'Graph entities' }).boundingBox();
    expect(mapBox).not.toBeNull();
    expect(entitiesBox).not.toBeNull();
    expect(mapBox!.y + mapBox!.height).toBeLessThan(entitiesBox!.y);
    await page.screenshot({ path: path.join(SHOTS, 'mobile-map.png') });
    await page.getByRole('tab', { name: 'graph' }).click();
    await expect(page.getByRole('region', { name: 'Context graph' })).toBeVisible();
  });

  test('mobile header keeps mock disclosure and controls in the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile only');
    await page.goto('/sites/3956008');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    for (const locator of [
      page.getByText('Mock data').first(),
      page.getByRole('button', { name: /^(Light|Dark)$/ }),
      page.getByRole('button', { name: 'Help' }),
    ]) {
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    }
    await page.screenshot({ path: path.join(SHOTS, 'mobile-header.png') });
  });

  test('mobile trust strip keeps diagnostics accessible without truncated metrics', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile only');
    await page.goto('/sites/3956008');

    await expect(page.locator('.truststrip > div')).toBeHidden();
    const diagnostics = page.getByRole('button', { name: 'Diagnostics' });
    await expect(diagnostics).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'mobile-trust-strip.png') });

    await diagnostics.click();
    const panel = page.getByRole('dialog', { name: 'Trust diagnostics' });
    await expect(panel.getByText('citation coverage')).toBeVisible();
  });

  test('map attribution stays visible and the mobile map does not overflow', async ({ page }, testInfo) => {
    await page.goto('/sites/3956008');
    if (testInfo.project.name === 'mobile') await page.getByRole('tab', { name: 'map' }).click();
    await expect(page.getByText(/OpenStreetMap/).first()).toBeVisible();
    await expect(page.getByText(/CARTO/).first()).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    }
  });

  test('theme toggle switches the existing map between CARTO styles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop source transition coverage');
    const requestedStyles: string[] = [];
    await page.route(/https:\/\/[a-d]\.basemaps\.cartocdn\.com\//, async (route) => {
      requestedStyles.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFgAI/5R5O9AAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });

    await page.goto('/sites/3956008');
    await expect.poll(() => requestedStyles.some((url) => url.includes('/dark_all/'))).toBe(true);
    const map = page.locator('.maplibregl-map');
    await map.evaluate((element) => {
      element.setAttribute('data-map-instance', 'original');
    });

    await page.getByRole('button', { name: 'Light' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => requestedStyles.some((url) => url.includes('/light_all/'))).toBe(true);
    await expect(map).toHaveAttribute('data-map-instance', 'original');
    await expect(page.getByText(/parcel 3956008 centered at/)).toBeVisible();
  });
});
