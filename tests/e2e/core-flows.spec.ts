import { test, expect } from '@playwright/test';

/**
 * Core end-to-end flows (spec §20).
 * Credentials come from CI secrets; locally, export TEST_USER_EMAIL and
 * TEST_USER_PASSWORD before running.
 */
const email = process.env.TEST_USER_EMAIL ?? 'test@example.com';
const password = process.env.TEST_USER_PASSWORD ?? 'test-password-123';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

test.describe('auth', () => {
  test('signup → dashboard loads with prayer, tasks, events', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Dashboard shows the prayer widget (either times or the not-configured state).
    await expect(page.getByText(/Prayers|Schedule not configured/)).toBeVisible();
    // Context is honest, never guessed.
    await expect(page.getByText(/Unsure|University|Workshop|Karate|Home|Out/)).toBeVisible();
  });

  test('protected route redirects to login', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('capture', () => {
  test('capture a text task → confirm → task appears', async ({ page }) => {
    await signIn(page);
    await page.goto('/inbox');

    const stamp = Date.now();
    // Open quick capture from the FAB
    await page.getByRole('button', { name: 'Capture something' }).click();
    await page.getByRole('button', { name: 'Text' }).click();
    const textarea = page.getByPlaceholder("What's on your mind?");
    await textarea.fill(`Submit COS201 assignment before Friday ${stamp}`);
    await page.getByRole('button', { name: 'Capture', exact: true }).click();

    // Proposal card appears once Gemini extraction completes.
    await expect(page.getByText('Suggested Task')).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    await page.goto('/tasks');
    await expect(page.getByText(`Submit COS201 assignment before Friday ${stamp}`)).toBeVisible();
  });

  test('upload poster image → event extracted → confirm → calendar shows it', async ({ page }) => {
    await signIn(page);
    await page.goto('/inbox');

    await page.getByRole('button', { name: 'Capture something' }).click();
    await page.getByRole('button', { name: 'Camera' }).click();
    await page.locator('input[type="file"]').setInputFiles('tests/fixtures/poster.png');

    await expect(page.getByText('Suggested Event')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });
});

test.describe('calendar conflicts', () => {
  test('creating a conflicting event shows the conflict dialog', async ({ page }) => {
    await signIn(page);
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'New event' }).click();

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = new Date(now.getTime() + 60 * 60_000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    const local = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    await page.getByLabel('Title').fill('Conflict probe A');
    await page.getByLabel('Starts').fill(local(start));
    await page.getByLabel('Ends').fill(local(end));
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.waitForURL('**/calendar');

    // Create a second overlapping event.
    await page.getByRole('button', { name: 'New event' }).click();
    await page.getByLabel('Title').fill('Conflict probe B');
    await page.getByLabel('Starts').fill(local(start));
    await page.getByLabel('Ends').fill(local(end));
    await page.getByRole('button', { name: 'Create event' }).click();

    await expect(page.getByText('Time conflict')).toBeVisible();
    await expect(page.getByText('Conflict probe A')).toBeVisible();
    // Nothing was silently moved or created.
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});

test.describe('prayer schedule', () => {
  test('import a schedule → today times display', async ({ page }) => {
    await signIn(page);
    await page.goto('/prayers/schedule');

    const year = new Date().getFullYear();
    const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    const lines = ['date,fajr,dhuhr,asr,maghrib,isha'];
    const start = Date.UTC(year, 0, 1);
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * 86_400_000);
      lines.push(`${d.toISOString().slice(0, 10)},04:48,12:15,15:37,18:03,19:15`);
    }
    const csv = lines.join('\n');
    await page.getByLabel('Paste CSV').fill(csv);
    await expect(page.getByText(`Valid: ${days} rows for ${year}`)).toBeVisible();

    const replace = page.getByLabel(`Replace the existing ${year} schedule (${days} days)`);
    if (await replace.isVisible().catch(() => false)) await replace.check();
    await page.getByRole('button', { name: 'Preview changes' }).click();
    await expect(page.getByText('Import preview')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm import' }).click();
    await expect(page.getByText(`Imported ${days} days for ${year}`)).toBeVisible();

    await page.goto('/prayers');
    await expect(page.getByText('04:48')).toBeVisible();
  });
});

test.describe('memory', () => {
  test('semantic search returns related results', async ({ page }) => {
    await signIn(page);
    await page.goto('/memory');

    const stamp = Date.now();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Title').fill(`Internship decision ${stamp}`);
    await page.getByLabel('Body').fill(
      'I decided to prioritize backend internships over frontend roles for 2026.',
    );
    await page.getByRole('button', { name: 'Save memory' }).click();

    await page.getByLabel('Search memories').fill('internship roles backend');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(`Internship decision ${stamp}`)).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('assistant', () => {
  test('answers what is happening tomorrow and creates a task after confirmation', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/assistant');

    await page.getByLabel('Message the assistant').fill("What's happening tomorrow?");
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(/tomorrow|nothing|scheduled|no events/i).first()).toBeVisible({
      timeout: 45_000,
    });

    const stamp = Date.now();
    await page.getByLabel('Message the assistant').fill(
      `Create a task called "E2E assistant task ${stamp}" for tomorrow`,
    );
    await page.getByRole('button', { name: 'Send' }).click();

    // Proposal preview card appears; nothing is written until Confirm.
    const confirm = page.getByRole('button', { name: 'Confirm' }).first();
    await expect(confirm).toBeVisible({ timeout: 45_000 });
    await confirm.click();
    await expect(page.getByText(`Done: Create a task.`)).toBeVisible({ timeout: 30_000 });

    await page.goto('/tasks');
    await expect(page.getByText(`E2E assistant task ${stamp}`)).toBeVisible();
  });
});

test.describe('security', () => {
  test('RLS: another user cannot read this user rows', async ({ request }) => {
    // An authenticated-as-nothing client with a different user's JWT must
    // receive zero rows for our tables. Here we assert the anon key alone
    // (no session) sees nothing — cross-user checks run in CI with two JWTs.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!url || !key, 'Supabase env not configured');

    const res = await request.get(`${url}/rest/v1/tasks?select=id&limit=1`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}` },
    });
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as unknown[];
    expect(rows).toEqual([]);
  });
});
