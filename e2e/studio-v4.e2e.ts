import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixtureMedia, installStudioFixtures, workspaceFixture, type StudioFixtures } from './helpers/studio-v4-fixtures';

const shootEntry = '/ai-editing?d=command-center&rec=shoot%3A42&media=images&preset=listing-ready';
const mutations = (state: StudioFixtures) => state.requests.filter(r => r.path.startsWith('/studio/workspaces') && !r.path.startsWith('/studio/workspaces/sources/') && r.method !== 'GET');
const generationRequests = (state: StudioFixtures) => state.requests.filter(r => /\/(generate|prepare|revisions)$/.test(r.path));

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function captureThemes(page: Page, testInfo: TestInfo, name: string) {
  await expect.poll(() => page.locator('.v4-home, .v4-editor').first().evaluate(element => {
    for (let current: Element | null = element; current; current = current.parentElement) {
      if (Number(getComputedStyle(current).opacity) < 0.999) return false;
    }
    return true;
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${name}-light.png`), animations: 'disabled' });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: testInfo.outputPath(`${name}-dark.png`), animations: 'disabled' });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
}

test.describe('V4 Studio with isolated HTTP fixtures', () => {
  test('authorizes and hydrates a shoot/preset link without creating or generating anything', async ({ page, baseURL }) => {
    const state = await installStudioFixtures(page, baseURL);
    await page.goto(shootEntry);
    await expect(page.getByRole('button', { name: 'View 12 selected files' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Editing preset' })).toHaveText(/Listing ready/);
    await expect(page.getByText('8704 Margaret Lane', { exact: true })).toBeVisible();
    const resolveIndex = state.requests.findIndex(r => r.path === '/studio/workspaces/sources/resolve');
    const mediaIndex = state.requests.findIndex(r => r.path === '/studio/workspaces/sources/shoots/42/media');
    expect(resolveIndex).toBeGreaterThanOrEqual(0);
    expect(mediaIndex).toBeGreaterThan(resolveIndex);
    expect(state.requests[resolveIndex].body).toMatchObject({ recordType: 'shoot', recordId: '42' });
    expect(mutations(state)).toEqual([]);
    expect(state.unexpectedStudioRequests).toEqual([]);
  });

  test('does not load shoot media when the server denies the deep link', async ({ page, baseURL }) => {
    const state = await installStudioFixtures(page, baseURL);
    state.denyShoot = true;
    await page.goto(shootEntry);
    await expect(page.getByRole('alert')).toContainText(/not authorized|access|unavailable/i);
    await expect(page.getByRole('button', { name: 'View 12 selected files' })).toHaveCount(0);
    expect(state.requests.some(r => r.path === '/studio/workspaces/sources/shoots/42/media')).toBe(false);
    expect(mutations(state)).toEqual([]);
  });

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    test(`selects an exact two-photo scope and opens a draft at ${viewport.width}px`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize(viewport);
      const state = await installStudioFixtures(page, baseURL);
      await page.goto('/ai-editing');
      await expect(page.getByRole('textbox', { name: 'Describe your edit' })).toBeVisible();
      await noPageOverflow(page);
      await expect(page.getByRole('button', { name: 'Continue to editor' })).toBeInViewport();
      const sourceSelector = page.getByRole('button', { name: /Select shoot/ });
      expect(await sourceSelector.locator('p').first().evaluate(label => label.scrollWidth <= label.clientWidth)).toBe(true);
      await captureThemes(page, testInfo, `home-${viewport.width}`);
      await sourceSelector.click();
      const picker = page.getByRole('dialog', { name: 'Add media' });
      await picker.getByRole('button', { name: 'Browse photos' }).click();
      await expect(picker.getByRole('img', { name: 'Image 01.jpg', exact: true })).toBeVisible();
      await expect.poll(() => picker.getByRole('img', { name: 'Image 01.jpg', exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(1);
      await picker.getByRole('button', { name: /Image 01.jpg/ }).click();
      await picker.getByRole('button', { name: /Image 03.jpg/ }).click();
      await expect(picker.getByRole('button', { name: 'Use 2 files' })).toBeEnabled();
      await noPageOverflow(page);
      await picker.getByRole('button', { name: 'Use 2 files' }).click();
      await expect(page.getByRole('button', { name: 'View 2 selected files' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Describe your edit' }).fill('Keep a natural look and preserve the windows.');
      await page.getByRole('button', { name: 'Continue to editor' }).click();
      await expect(page).toHaveURL(/workspace=ws-created-1/);
      await expect(page.getByRole('button', { name: 'Generate 2 photos', exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Image 01.jpg original', exact: true })).toBeVisible();
      await expect.poll(() => page.getByRole('img', { name: 'Image 01.jpg original', exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(1);
      const creation = mutations(state).find(r => r.method === 'POST' && r.path === '/studio/workspaces');
      expect(creation?.body).toMatchObject({ presetId: 'listing-ready', config: { prompt: 'Keep a natural look and preserve the windows.' } });
      expect((creation?.body?.media as { id: string }[]).map(m => m.id)).toEqual(['file:101', 'file:103']);
      expect(generationRequests(state)).toEqual([]);
      await noPageOverflow(page);
      await expect(page.getByRole('button', { name: 'Generate 2 photos', exact: true })).toBeInViewport();
      await captureThemes(page, testInfo, `workspace-${viewport.width}`);
      expect(state.unexpectedStudioRequests).toEqual([]);
    });
  }

  test('keeps edits after save/submit errors and recovers a polling error without submitting twice', async ({ page, baseURL }) => {
    const draft = workspaceFixture();
    const state = await installStudioFixtures(page, baseURL, [draft]);
    await page.goto(`/ai-editing?workspace=${draft.id}`);
    const generate = page.getByRole('button', { name: 'Generate 3 photos', exact: true });
    await expect(generate).toBeVisible();
    expect(generationRequests(state)).toEqual([]);
    const direction = page.getByPlaceholder('Describe anything specific to this property…');
    await direction.fill('Preserve the original window proportions.');
    state.failures.update = 1;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Fixture update unavailable');
    await expect(direction).toHaveValue('Preserve the original window proportions.');
    expect(generationRequests(state)).toEqual([]);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.workspaces.get(draft.id)?.config.prompt).toBe('Preserve the original window proportions.');
    state.failures.generate = 1;
    await generate.click();
    await expect(page.getByRole('alert')).toContainText('Fixture generate unavailable');
    await expect(generate).toBeEnabled();
    expect(state.workspaces.get(draft.id)?.version).toBe(3);
    state.failures.poll = 10;
    await generate.click();
    await expect(page.getByRole('button', { name: 'Editing photos', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Fixture poll unavailable', { timeout: 15000 });
    expect(generationRequests(state)).toHaveLength(2);
    expect(state.requests.filter(r => r.method === 'PATCH').map(r => r.body?.version)).toEqual([1, 1, 2, 3]);
    expect(state.workspaces.get(draft.id)?.version).toBe(5);
    state.failures.poll = 0;
    const running = state.workspaces.get(draft.id)!;
    running.status = 'completed'; running.progress = 100;
    running.outputs = running.media.map(m => ({ id: `out-${m.id}`, mediaId: m.id, url: m.url, kind: 'image', version: 1, status: 'completed' }));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gallery review', exact: true })).toBeVisible();
    expect(generationRequests(state)).toHaveLength(2);
    expect(state.unexpectedStudioRequests).toEqual([]);
  });

  test('resumes history and retries one-photo feedback without changing the other outputs', async ({ page, baseURL }) => {
    const saved = workspaceFixture({ status: 'completed', progress: 100,
      outputs: fixtureMedia.slice(0, 3).map(m => ({ id: `out-${m.id}`, mediaId: m.id, url: m.url, kind: 'image', version: 2, status: 'completed' })),
    });
    const state = await installStudioFixtures(page, baseURL, [saved]);
    await page.goto('/ai-editing');
    await page.getByRole('button', { name: 'Editing history' }).click();
    await expect(page.getByRole('heading', { name: 'Your editing history' })).toBeVisible();
    await page.getByRole('button', { name: /Georgetown listing photos/ }).click();
    await expect(page).toHaveURL(/workspace=ws-fixture-1/);
    await expect(page.getByRole('button', { name: 'Open Image 01.jpg' })).toBeVisible();
    expect(mutations(state)).toEqual([]);
    await page.getByRole('button', { name: 'Refine selected', exact: true }).click();
    const feedback = page.getByRole('dialog', { name: 'Refine Image 01.jpg' });
    await feedback.getByRole('textbox', { name: 'Describe the change' }).fill('Neutralize the ceiling warm cast. Keep the lights and texture.');
    state.failures.revise = 1;
    await feedback.getByRole('button', { name: 'Generate revision' }).click();
    await expect(feedback.getByRole('alert')).toContainText('Fixture revise unavailable');
    await expect(feedback.getByRole('textbox')).toHaveValue('Neutralize the ceiling warm cast. Keep the lights and texture.');
    await feedback.getByRole('button', { name: 'Generate revision' }).click();
    await expect(feedback).toBeHidden();
    const revisions = generationRequests(state);
    expect(revisions).toHaveLength(2);
    expect(revisions[1].body).toMatchObject({ mediaId: 'file:101', prompt: 'Neutralize the ceiling warm cast. Keep the lights and texture.' });
    expect(state.workspaces.get(saved.id)?.outputs).toEqual(saved.outputs);
    expect(state.unexpectedStudioRequests).toEqual([]);
  });

  test('downloads the reviewed older photo version through the authorized attachment endpoint', async ({ page, baseURL }) => {
    const photo = fixtureMedia[0];
    const saved = workspaceFixture({ status: 'completed', progress: 100, media: [photo],
      outputs: [1, 2].map(version => ({ id: `output-photo-101-v${version}`, mediaId: photo.id,
        url: photo.url, kind: 'image', version, status: 'completed' })),
    });
    saved.config.frames = [{ mediaId: photo.id, method: 'fit', duration: 5 }];
    const state = await installStudioFixtures(page, baseURL, [saved]);
    await page.goto(`/ai-editing?workspace=${saved.id}`);
    await page.getByRole('button', { name: 'Version 1', exact: true }).click();
    await page.getByRole('button', { name: 'Use this photo', exact: true }).click();
    await page.getByRole('button', { name: 'Finish review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your photos are ready' })).toBeVisible();
    await expect(page.locator('.v4-download-row')).toContainText('Version 1');
    expect(state.workspaces.get(saved.id)?.config.reviewedOutputIds).toEqual(['output-photo-101-v1']);

    const receivedDownloads: string[] = [];
    page.on('download', download => receivedDownloads.push(download.suggestedFilename()));
    state.failures.download = 1;
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Fixture download unavailable');
    expect(receivedDownloads).toEqual([]);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadEvent;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe('Image 01-v1.webp');
    const downloaded = await readFile((await download.path())!);
    expect(downloaded.length).toBeGreaterThan(1000);
    expect(downloaded.subarray(0, 4).toString()).toBe('RIFF');
    expect(downloaded.subarray(8, 12).toString()).toBe('WEBP');
    expect(state.requests.filter(request => request.path.endsWith('/download')).map(request => request.path)).toEqual([
      `/studio/workspaces/${saved.id}/outputs/output-photo-101-v1/download`,
      `/studio/workspaces/${saved.id}/outputs/output-photo-101-v1/download`,
    ]);
    expect(generationRequests(state)).toEqual([]);
    expect(state.unexpectedStudioRequests).toEqual([]);
  });

  test('mobile reel prepares and reviews all six frames before a 30-second seamless generation', async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const reel = workspaceFixture({ presetId: 'walkthrough', name: 'Georgetown walkthrough', media: fixtureMedia.slice(0, 6) });
    reel.config = { ...reel.config, ratio: '9:16', duration: 30, frames: reel.media.map(m => ({ mediaId: m.id, method: 'extend', duration: 5 })) };
    const state = await installStudioFixtures(page, baseURL, [reel]);
    await page.goto(`/ai-editing?workspace=${reel.id}`);
    await page.getByRole('button', { name: 'Choose 6 scenes', exact: true }).click();
    await page.getByRole('button', { name: 'Use 6 scenes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Extend & crop frames', exact: true })).toBeVisible();
    expect(generationRequests(state)).toEqual([]);
    await noPageOverflow(page);
    await expect(page.getByRole('button', { name: 'Prepare 6 frames', exact: true })).toBeInViewport();
    await captureThemes(page, testInfo, 'reel-framing-390');
    await page.getByRole('button', { name: 'Prepare 6 frames', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Preparing frames', exact: true })).toBeDisabled();
    expect(generationRequests(state).map(r => r.path)).toEqual([`/studio/workspaces/${reel.id}/prepare`]);
    const preparing = state.workspaces.get(reel.id)!;
    preparing.status = 'ready'; preparing.progress = 100;
    preparing.preparedFrames = preparing.config.frames.map(f => ({ mediaId: f.mediaId, method: f.method, url: '/studio-assets/hero-after.webp', status: 'completed', version: 1 }));
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use 6 frames', exact: true })).toBeDisabled();
    for (let i = 0; i < 6; i += 1) await page.getByRole('button', { name: 'Use frame', exact: true }).first().click();
    await page.getByRole('button', { name: 'Use 6 frames', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Generate 30s reel', exact: true })).toBeEnabled();
    await noPageOverflow(page);
    await page.getByRole('button', { name: 'Generate 30s reel', exact: true }).click();
    await expect.poll(() => generationRequests(state).length).toBe(2);
    expect(state.workspaces.get(reel.id)?.config).toMatchObject({ duration: 30, ratio: '9:16', transition: 'none', text: { style: 'none' } });
    expect(generationRequests(state)[1].path).toBe(`/studio/workspaces/${reel.id}/generate`);
    expect(state.unexpectedStudioRequests).toEqual([]);
  });
});
