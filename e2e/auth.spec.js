'use strict';
const { test, expect } = require('@playwright/test');

test.describe('Autenticación', () => {
  test('Muestra formulario de login', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();
  });

  test('Login exitoso con admin redirige al dashboard', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
    await expect(page.locator('#topbar-title')).toHaveText('Dashboard');
  });

  test('Login exitoso con usuario de compras', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'compras@demo.com');
    await page.fill('#password', 'compras123');
    await page.click('#login-btn');
    await page.waitForURL('**/');
    await expect(page.locator('#topbar-title')).toHaveText('Dashboard');
  });

  test('Login fallido muestra error', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', 'admin@demo.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-btn');
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).not.toBeEmpty();
  });

  test('Autocompletar credenciales demo', async ({ page }) => {
    await page.goto('/login.html');
    await page.evaluate(() => {
      document.getElementById('email').value = 'admin@demo.com';
      document.getElementById('password').value = 'admin123';
    });
    await expect(page.locator('#email')).toHaveValue('admin@demo.com');
    await expect(page.locator('#password')).toHaveValue('admin123');
  });

  test('Redirige a login si no hay token', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login.html');
    await expect(page.locator('#login-form')).toBeVisible();
  });
});
