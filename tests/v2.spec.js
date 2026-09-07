import { test, expect } from '@playwright/test';

test.describe('V2 Core Playback & Navigation', () => {
  
  test('Landing Page renders and opens Auth Modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Podcast Vault')).toBeVisible();
    await expect(page.locator('text=Start Listening Now')).toBeVisible();
    
    // Open Auth Modal
    await page.click('text=Log In');
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  // Since we require Supabase auth to proceed, a full E2E test without a test user is tricky.
  // Assuming we bypass auth or have a test user:
  test('App Shell renders when authenticated', async ({ page }) => {
    // In a real environment, we'd inject session into localStorage or login.
    // We will simulate local storage state.
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-ywfwsklpmoogvfscjrja-auth-token', JSON.stringify({
        access_token: 'fake_token',
        user: { id: 'test_user', email: 'test@example.com' }
      }));
    });
    
    await page.goto('/');
    
    // Check Topbar and Sidebar
    await expect(page.locator('.v2-topbar')).toBeVisible();
    await expect(page.locator('.v2-sidebar')).toBeVisible();
  });

  test('Audio Engine initializes correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-ywfwsklpmoogvfscjrja-auth-token', JSON.stringify({
        access_token: 'fake_token',
        user: { id: 'test_user', email: 'test@example.com' }
      }));
      // Pre-seed a queue item to check if the player mounts
      window.localStorage.setItem('v2_player_state', JSON.stringify({
        savedQueue: [{ id: '1', title: 'Test Track', artist: 'Test Artist', url: 'https://example.com/audio.mp3' }],
        savedIndex: 0,
        savedVolume: 0.5
      }));
    });

    await page.goto('/');

    // Check if player mounted and restored state
    await expect(page.locator('.v2-player')).toBeVisible();
    await expect(page.locator('text=Test Track')).toBeVisible();
  });

});

