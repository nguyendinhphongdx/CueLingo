import { expect, test } from '@playwright/test';
import { magicLinkFor, seedMeeting } from './support';

const EMAIL = `e2e-${Date.now()}@example.com`;

test('sign in, read a debrief, save a phrase, review it and see the progress', async ({ page }) => {
  // Sign in with a magic link, as a person would from their email.
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click();
  await page.goto(await magicLinkFor(EMAIL));
  await expect(page).not.toHaveURL(/\/login/);

  // A finished meeting appears in the library and opens as a debrief.
  const sessionId = await seedMeeting(EMAIL);
  await page.goto('/sessions');
  await page.getByRole('link', { name: /Họp roadmap E2E/ }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}`));
  await expect(page.getByText('Thống nhất xem lại lộ trình')).toBeVisible();
  await expect(page.getByText('Chúng ta quay lại lộ trình sau cuộc gọi nhé?')).toBeVisible();

  // Save the suggested phrase.
  const suggestions = page.getByRole('region', { name: 'Cụm từ nên lưu' });
  await suggestions.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(suggestions.getByRole('button', { name: 'Đã lưu' })).toBeVisible();

  // It is in the phrase bank and comes up for review.
  await page.goto('/phrases');
  await expect(page.getByText('circle back')).toBeVisible();
  await page.goto('/review');
  await expect(page.getByText('1/1')).toBeVisible();
  // Which exercise a phrase gets depends on its id, so answer whichever card comes up.
  const typing = page.getByRole('textbox', { name: 'Gõ cụm từ bạn nghe được' });
  if (await typing.isVisible()) {
    await typing.fill('circle back');
    await page.getByRole('button', { name: 'Kiểm tra' }).click();
  } else {
    await page.getByRole('button', { name: 'quay lại bàn sau' }).click();
  }
  await page.getByRole('button', { name: 'Được' }).click();

  // The session and the review show in the progress.
  await page.goto('/progress');
  await expect(page.getByText('Tiến độ', { exact: true }).first()).toBeVisible();
  const saved = page
    .locator('dt', { hasText: /^Cụm đã lưu$/ })
    .locator('xpath=following-sibling::dd');
  await expect(saved).toHaveText('1');
});
