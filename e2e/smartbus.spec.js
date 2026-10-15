import { test, expect } from '@playwright/test';

const password = 'SmartBus@123';

async function login(page, role) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}@smartbus.demo`);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

function localTomorrow() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(new Date(Date.now() + 86_400_000));
}

test.describe('SmartBus browser E2E', () => {
  test('responsive 1920/1366/1024/768/390 without horizontal overflow', async ({ page }) => {
    for (const [width, height] of [[1920,1080],[1366,768],[1024,768],[768,1024],[390,844]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Đặt vé xe buýt dễ dàng/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow at ${width}x${height}`).toBeLessThanOrEqual(2);
    }
  });

  test('Passenger: login -> search -> select -> 10-minute hold -> sandbox payment -> QR ticket', async ({ page }) => {
    await login(page, 'passenger');
    await page.getByLabel('Ngày khởi hành').fill(localTomorrow());
    await page.getByRole('button', { name: /Tìm chuyến xe/ }).click();
    const choose = page.getByRole('link', { name: /Chọn ghế/ }).first();
    await expect(choose).toBeVisible();
    await choose.click();
    const availableSeat = page.locator('button.seat:not([disabled])').first();
    await expect(availableSeat).toBeVisible();
    await availableSeat.click();
    await page.getByRole('button', { name: /Giữ ghế .*10 phút/ }).click();
    await expect(page.getByLabel('Thời gian giữ ghế còn lại')).toContainText(/0[89]:|10:/);
    await expect(page.getByText('Thanh toán mô phỏng')).toBeVisible();
    await page.getByRole('button', { name: /Mô phỏng thanh toán/ }).click();
    await expect(page).toHaveURL(/\/tickets/);
    await page.getByRole('button', { name: /Hiển thị vé QR/ }).first().click();
    await expect(page.getByAltText(/Mã QR của vé/).first()).toBeVisible();
    await expect(page.locator('.ticket-code').first()).toContainText(/SB-/);
  });

  test('Driver: camera QR entry path and manual scan form are available', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation'], { origin: 'http://127.0.0.1:5173' });
    await login(page, 'driver');
    await expect(page.getByRole('heading', { name: 'Tác nghiệp tài xế' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quét mã bằng camera' })).toBeVisible();
    await page.getByRole('button', { name: 'Quét mã bằng camera' }).click();
    await expect(page.locator('video[aria-label="Khung camera quét mã QR"]')).toBeVisible();
    await expect(page.getByLabel('Mã vé hoặc nội dung QR')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng camera' }).click();
  });

  test('Manager: operations + AI analytics UI', async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/\/manage/);
    await expect(page.getByRole('heading', { name: 'Quản lý vận hành' })).toBeVisible();
    await page.getByRole('button', { name: 'AI phân tích' }).click();
    await expect(page.getByText(/phân tích|dự báo/i).first()).toBeVisible();
  });

  test('Admin: user management and audit UI', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Tài khoản' }).click();
    await expect(page.getByRole('heading', { name: 'Quản lý tài khoản' })).toBeVisible();
    await page.getByRole('button', { name: 'Nhật ký' }).click();
    await expect(page.getByRole('heading', { name: 'Nhật ký hoạt động' })).toBeVisible();
  });
});
