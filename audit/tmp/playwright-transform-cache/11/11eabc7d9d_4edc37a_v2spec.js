// 3d5e55009cb06f03f7ae3069b5dd90e1076f0661
import { test, expect } from '@playwright/test';
import { setup, tracks, userId, playerBar, playFirst } from './fixtures';
test('landing, login, registration confirmation and authenticated routes', async ({
  page
}) => {
  const {
    errors
  } = await setup(page, {
    signedIn: false
  });
  await page.goto('/');
  await page.getByRole('button', {
    name: 'Log In',
    exact: true
  }).click();
  await page.locator('input[type=email]').fill('listener@example.test');
  await page.locator('input[type=password]').fill('fixture-password');
  await page.getByRole('dialog').getByRole('button', {
    name: 'Log In',
    exact: true
  }).click();
  await expect(page.locator('.v2-topbar')).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', {
    name: 'Log out'
  }).click();
  await expect(page.getByRole('button', {
    name: 'Start Listening Now'
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'Sign Up',
    exact: true
  }).click();
  if (await page.getByRole('heading', {
    name: 'Welcome Back'
  }).count()) await page.getByRole('button', {
    name: 'Sign up',
    exact: true
  }).click();
  await page.locator('input[type=text]').fill('New listener');
  await page.locator('input[type=email]').fill('new@example.test');
  await page.locator('input[type=password]').fill('fixture-password');
  await page.getByRole('dialog').getByRole('button', {
    name: 'Sign Up',
    exact: true
  }).click();
  await expect(page.getByText('Check your email to confirm your account, then log in.')).toBeVisible();
  expect(errors).toEqual([]);
});
for (const shuffle of [false, true]) for (const repeat of ['none', 'one', 'all']) {
  test(`natural endings: shuffle=${shuffle}, repeat=${repeat}`, async ({
    page
  }) => {
    const {
      errors
    } = await setup(page, {
      seconds: 1.2,
      preferences: {
        volume: .1,
        shuffle,
        repeat,
        autoplay: true
      }
    });
    await playFirst(page);
    await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length), {
      timeout: 12000
    }).toBeGreaterThanOrEqual(3);
    const played = await page.evaluate(() => window.mediaEvents.filter(e => e.event === 'playing').map(e => new URL(e.src).pathname));
    if (repeat === 'one') expect(new Set(played).size).toBe(1);else if (!shuffle) expect(played.slice(0, 3)).toEqual(['/test-audio/1.wav', '/test-audio/2.wav', '/test-audio/3.wav']);else expect(new Set(played.slice(0, 3)).size).toBe(3);
    if (repeat === 'none') await expect(playerBar(page).getByTitle('Play', {
      exact: true
    })).toBeVisible();
    if (repeat === 'all') await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'playing').length)).toBeGreaterThanOrEqual(4);
    expect(await page.evaluate(() => window.testAudio.filter(a => a.src).length)).toBe(1);
    expect(errors).toEqual([]);
  });
}
test('repeat-all restarts a one-item queue, duplicates advance and restoration stays paused', async ({
  page
}) => {
  const queue = [tracks(1)[0], tracks(1)[0]];
  await setup(page, {
    player: {
      queue,
      index: 0,
      currentTime: 0
    },
    preferences: {
      volume: .1,
      repeat: 'all',
      shuffle: false,
      autoplay: true
    }
  });
  await page.goto('/music');
  await expect(playerBar(page).getByTitle('Play', {
    exact: true
  })).toBeVisible();
  expect(await page.evaluate(() => window.mediaEvents.filter(e => e.event === 'playing').length)).toBe(0);
  await playerBar(page).getByTitle('Play', {
    exact: true
  }).click();
  await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length)).toBeGreaterThanOrEqual(2);
  await playerBar(page).getByTitle('Open Now Playing', {
    exact: true
  }).first().click();
  await page.getByRole('button', {
    name: 'Remove Track 1 from queue',
    exact: true
  }).last().click();
  const before = await page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length);
  await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length)).toBeGreaterThan(before);
});
test('queue removal, seek, pause, volume and refresh persistence', async ({
  page
}) => {
  const {
    errors
  } = await setup(page);
  await playFirst(page);
  await playerBar(page).getByTitle('Next', {
    exact: true
  }).click();
  await expect(playerBar(page)).toContainText('Track 2');
  await playerBar(page).getByTitle('Pause', {
    exact: true
  }).click();
  await playerBar(page).getByRole('slider', {
    name: 'Playback position'
  }).press('ArrowRight');
  await playerBar(page).getByTitle('Open Now Playing', {
    exact: true
  }).first().click();
  await page.getByRole('button', {
    name: 'Remove Track 1 from queue',
    exact: true
  }).click();
  await expect(playerBar(page)).toContainText('Track 2');
  await page.getByRole('button', {
    name: 'Remove Track 2 from queue',
    exact: true
  }).click();
  await expect(playerBar(page)).toContainText('Track 3');
  await page.getByTitle('Close', {
    exact: true
  }).click();
  await playerBar(page).getByRole('slider', {
    name: 'Volume',
    exact: true
  }).fill('0.35');
  await page.reload();
  await expect(playerBar(page)).toContainText('Track 3');
  await expect(playerBar(page).getByTitle('Play', {
    exact: true
  })).toBeVisible();
  await expect(playerBar(page).getByRole('slider', {
    name: 'Volume',
    exact: true
  })).toHaveValue('0.35');
  expect(errors).toEqual([]);
});
test('playlist CRUD, song ordering and profile persist through refresh', async ({
  page
}) => {
  const {
    db,
    errors
  } = await setup(page);
  await page.goto('/library');
  await page.getByRole('button', {
    name: 'Create playlist',
    exact: true
  }).click();
  await page.getByLabel('Name', {
    exact: true
  }).fill('Road trip');
  await page.getByLabel('Description', {
    exact: true
  }).fill('Songs for the road');
  await page.getByRole('button', {
    name: 'Save playlist'
  }).click();
  await page.getByLabel('Add song', {
    exact: true
  }).selectOption(db.music_tracks[0].id);
  await page.getByLabel('Add song', {
    exact: true
  }).selectOption(db.music_tracks[1].id);
  await page.getByRole('button', {
    name: 'Move Track 2 up'
  }).click();
  await expect.poll(() => db.playlists[0]?.track_ids[0]).toBe(db.music_tracks[1].id);
  await page.reload();
  await expect(page.getByRole('heading', {
    name: 'Road trip'
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'Play playlist'
  }).click();
  await expect(playerBar(page)).toContainText('Track 2');
  await page.getByRole('button', {
    name: 'Edit playlist'
  }).click();
  await page.getByLabel('Name', {
    exact: true
  }).fill('Road trip edited');
  await page.getByRole('button', {
    name: 'Save playlist'
  }).click();
  await page.getByRole('button', {
    name: 'Remove Track 1',
    exact: true
  }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {
    name: 'Delete playlist'
  }).click();
  await expect.poll(() => db.playlists.length).toBe(0);
  await page.goto('/profile');
  await page.getByRole('button', {
    name: 'Edit profile'
  }).click();
  await page.getByLabel('Display name').fill('Updated listener');
  await page.getByLabel('Username', {
    exact: true
  }).fill('updated_listener');
  await page.getByRole('button', {
    name: 'Save profile'
  }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {
    name: 'Updated listener'
  })).toBeVisible();
  expect(errors).toEqual([]);
});
test('settings, filtering, search and podcast pause/resume', async ({
  page
}) => {
  const {
    podcastId,
    errors
  } = await setup(page);
  await page.goto('/settings');
  await page.getByLabel('Shuffle', {
    exact: true
  }).check();
  await page.getByLabel('Repeat', {
    exact: true
  }).selectOption('one');
  await page.getByLabel('Automatically play next').uncheck();
  await page.getByLabel('Theme').selectOption('light');
  await page.reload();
  await expect(page.getByLabel('Shuffle', {
    exact: true
  })).toBeChecked();
  await expect(page.getByLabel('Repeat', {
    exact: true
  })).toHaveValue('one');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/music');
  await page.getByRole('tab', {
    name: 'Rock',
    exact: true
  }).click();
  await expect(page.locator('.v2-premium-card')).toHaveCount(1);
  await page.getByRole('textbox', {
    name: 'Search library'
  }).fill('Track 3');
  await expect(page.locator('.v2-search-results')).toContainText('Track 3');
  await page.goto(`/podcasts/${podcastId}`);
  await page.locator('.v2-ep-row').filter({
    hasText: 'Episode 2'
  }).click();
  await expect(playerBar(page)).toContainText('Episode 2');
  await page.locator('.v2-ep-row').filter({
    hasText: 'Episode 2'
  }).click();
  await expect(playerBar(page).getByTitle('Play', {
    exact: true
  })).toBeVisible();
  expect(errors).toEqual([]);
});
test('favorites and real history survive refresh; logout clears private UI and audio', async ({
  page
}) => {
  const {
    db,
    errors
  } = await setup(page);
  await playFirst(page);
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThan(1);
  await playerBar(page).getByTitle('Favorite', {
    exact: true
  }).click();
  await playerBar(page).getByTitle('Pause', {
    exact: true
  }).click();
  await expect.poll(() => db.soundverse_activity.filter(r => r.liked).length).toBe(1);
  await page.goto('/library');
  await expect(page.getByRole('heading', {
    name: 'Listening history'
  })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {
    name: 'Favorite content'
  }).locator('..')).toContainText('Track 1');
  await page.goto('/settings');
  await page.getByRole('button', {
    name: 'Log out'
  }).click();
  await expect(page.locator('.v2-player-bar')).toHaveCount(0);
  expect(await page.evaluate(() => window.testAudio.filter(a => a.src).length)).toBe(0);
  expect(errors).toEqual([]);
});
test('catalog failures and admin denial remain visible without crashes', async ({
  page
}) => {
  const {
    errors
  } = await setup(page, {
    fail: 'music_tracks'
  });
  await page.goto('/music');
  await expect(page.getByRole('alert')).toContainText('music_tracks unavailable');
  await page.goto('/admin');
  await expect(page.getByText('You do not have access to administration.')).toBeVisible();
  expect(errors).toEqual([]);
});
for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800], [768, 1024], [430, 932], [390, 844], [375, 812]]) {
  test(`responsive ${width}x${height}`, async ({
    page
  }) => {
    const {
      errors
    } = await setup(page);
    await page.setViewportSize({
      width,
      height
    });
    await playFirst(page);
    for (const path of ['/music', '/library', '/settings', '/profile', '/podcasts', '/']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflow = await page.locator('.v2-main-content').evaluate(el => el.scrollWidth > el.clientWidth + 1);
      expect(overflow, `Content overflow on ${path}`).toBe(false);
    }
    await playerBar(page).getByTitle('Open Now Playing', {
      exact: true
    }).first().click();
    await expect(page.locator('.v2-np-fullscreen').getByTitle('Play', {
      exact: true
    })).toBeVisible();
    await page.screenshot({
      path: `audit/player-${width}x${height}.png`
    });
    expect(errors).toEqual([]);
  });
}
test('autoplay off stops after a natural ending', async ({
  page
}) => {
  await setup(page, {
    seconds: 1,
    preferences: {
      volume: .1,
      repeat: 'none',
      shuffle: false,
      autoplay: false
    }
  });
  await playFirst(page);
  await expect.poll(() => page.evaluate(() => window.mediaEvents.filter(e => e.event === 'ended').length)).toBe(1);
  await expect(playerBar(page)).toContainText('Track 1');
  await expect(playerBar(page).getByTitle('Play', {
    exact: true
  })).toBeVisible();
});
test('play next overrides shuffle, track menu favorites and add-to-playlist work', async ({
  page
}) => {
  const {
    db
  } = await setup(page, {
    preferences: {
      volume: .1,
      shuffle: true,
      repeat: 'none',
      autoplay: true
    }
  });
  db.playlists.push({
    id: '55555555-5555-4555-8555-555555555555',
    user_id: userId,
    name: 'Saved songs',
    track_ids: [],
    revision: 0
  });
  await playFirst(page);
  const card = page.locator('.v2-premium-card').filter({
    hasText: 'Track 3'
  });
  await card.getByLabel('Actions for Track 3').click();
  await card.getByRole('button', {
    name: 'Play next',
    exact: true
  }).click();
  await card.getByLabel('Add Track 3 to playlist').selectOption(db.playlists[0].id);
  await expect.poll(() => db.playlists[0].track_ids.length).toBe(1);
  await playerBar(page).getByTitle('Next', {
    exact: true
  }).click();
  await expect(playerBar(page)).toContainText('Track 3');
});
test('playback rejection and failed media show recoverable errors', async ({
  page
}) => {
  const {
    errors
  } = await setup(page);
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    let rejected = false;
    HTMLMediaElement.prototype.play = function () {
      if (!rejected) {
        rejected = true;
        return Promise.reject(new DOMException('Blocked fixture', 'NotAllowedError'));
      }
      return nativePlay.call(this);
    };
  });
  await page.goto('/music');
  await page.locator('.v2-premium-card').filter({
    hasText: 'Track 1'
  }).click();
  await expect(page.getByRole('alert')).toContainText('Playback was blocked');
  await playerBar(page).getByTitle('Play', {
    exact: true
  }).click();
  await expect(playerBar(page).getByTitle('Pause', {
    exact: true
  })).toBeVisible();
  await page.route('**/test-audio/2.wav?**', route => route.fulfill({
    status: 404,
    body: 'Not found'
  }));
  await playerBar(page).getByTitle('Next', {
    exact: true
  }).click();
  await expect(page.getByRole('alert')).toContainText(/Audio could not be loaded|Unable to play/);
  await playerBar(page).getByTitle('Next', {
    exact: true
  }).click();
  await expect(playerBar(page)).toContainText('Track 3');
  await expect(playerBar(page).getByTitle('Pause', {
    exact: true
  })).toBeVisible();
  expect(errors).toEqual([]);
});
test('offline activity persists locally and reports cloud failure', async ({
  page
}) => {
  await setup(page, {
    fail: 'soundverse_activity'
  });
  await playFirst(page);
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThan(1);
  await playerBar(page).getByTitle('Favorite', {
    exact: true
  }).click();
  await expect(page.getByRole('status')).toContainText('cloud sync failed');
  await playerBar(page).getByTitle('Pause', {
    exact: true
  }).click();
  await page.reload();
  await expect(playerBar(page).getByTitle('Remove favorite', {
    exact: true
  })).toBeVisible();
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`soundverse_activity:${id}`)), userId);
  expect(saved.dirty.length).toBeGreaterThan(0);
  expect(Object.values(saved.rows)[0].listened_seconds).toBeGreaterThan(0);
});
test('corrupt storage does not crash and empty queue stays empty after refresh', async ({
  page
}) => {
  const {
    errors
  } = await setup(page, {
    preferences: {
      volume: 'bad',
      repeat: 'bogus',
      shuffle: 'bad'
    },
    player: {
      queue: [{
        id: {},
        title: {}
      }],
      index: -100
    }
  });
  await page.goto('/music');
  await expect(page.locator('.v2-premium-card')).toHaveCount(3);
  await page.locator('.v2-premium-card').filter({
    hasText: 'Track 1'
  }).click();
  await playerBar(page).getByTitle('Open Now Playing', {
    exact: true
  }).first().click();
  for (const n of [3, 2, 1]) await page.getByRole('button', {
    name: `Remove Track ${n} from queue`,
    exact: true
  }).click();
  await expect(playerBar(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.v2-premium-card')).toHaveCount(3);
  await expect(playerBar(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('podcast resume restores the saved offset after metadata loads', async ({
  page
}) => {
  const {
    podcastId
  } = await setup(page, {
    seconds: 30
  });
  await page.goto(`/podcasts/${podcastId}`);
  await page.locator('.v2-ep-row').filter({
    hasText: 'Episode 1'
  }).click();
  await expect(playerBar(page).getByTitle('Pause', {
    exact: true
  })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThan(.3);
  await playerBar(page).getByRole('slider', {
    name: 'Playback position'
  }).press('ArrowRight');
  await playerBar(page).getByTitle('Pause', {
    exact: true
  }).click();
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThan(5);
  await page.reload();
  await expect(playerBar(page).getByTitle('Play', {
    exact: true
  })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThan(5);
  await page.locator('.v2-ep-row').filter({
    hasText: 'Episode 1'
  }).click();
  await expect(playerBar(page).getByTitle('Pause', {
    exact: true
  })).toBeVisible();
});
test('admin creates, edits, publishes and deletes catalog content', async ({
  page
}) => {
  const {
    db,
    errors
  } = await setup(page, {
    admin: true
  });
  await page.goto('/admin');
  await page.getByRole('button', {
    name: 'Add content'
  }).click();
  await page.getByLabel('title', {
    exact: true
  }).fill('Admin song');
  await page.getByLabel('audio url', {
    exact: true
  }).fill('https://example.test/song.mp3');
  await page.getByRole('button', {
    name: 'Save content'
  }).click();
  const row = page.locator('.v2-media-row').filter({
    hasText: 'Admin song'
  });
  await expect(row).toBeVisible();
  await row.getByRole('button', {
    name: 'Publish',
    exact: true
  }).click();
  await expect.poll(() => db.music_tracks.find(t => t.title === 'Admin song')?.published).toBe(true);
  await row.getByRole('button', {
    name: 'Edit',
    exact: true
  }).click();
  await page.getByLabel('title', {
    exact: true
  }).fill('Edited song');
  await page.getByRole('button', {
    name: 'Save content'
  }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.v2-media-row').filter({
    hasText: 'Edited song'
  }).getByRole('button', {
    name: 'Delete'
  }).click();
  await expect.poll(() => db.music_tracks.some(t => t.title === 'Edited song')).toBe(false);
  expect(errors).toEqual([]);
});
test('stale playlist updates show a conflict instead of overwriting', async ({
  page
}) => {
  const {
    db
  } = await setup(page);
  const id = '55555555-5555-4555-8555-555555555555';
  db.playlists.push({
    id,
    user_id: userId,
    name: 'Shared across tabs',
    track_ids: [],
    revision: 0
  });
  await page.goto(`/library?playlist=${id}`);
  await expect(page.getByRole('heading', {
    name: 'Shared across tabs'
  })).toBeVisible();
  db.playlists[0].revision = 1;
  await page.getByLabel('Add song', {
    exact: true
  }).selectOption(db.music_tracks[0].id);
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  expect(db.playlists[0].track_ids).toEqual([]);
});
test('landing and dialogs fit mobile and keyboard focus stays in dialogs', async ({
  page
}) => {
  await setup(page, {
    signedIn: false
  });
  await page.setViewportSize({
    width: 375,
    height: 812
  });
  await page.goto('/');
  await expect(page.getByRole('button', {
    name: 'Sign Up',
    exact: true
  })).toBeInViewport();
  await page.screenshot({
    path: 'audit/landing-mobile.png',
    fullPage: true
  });
  await page.getByRole('button', {
    name: 'Sign Up',
    exact: true
  }).click();
  await expect(page.getByRole('heading', {
    name: 'Create Account'
  })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ0ZXN0IiwiZXhwZWN0Iiwic2V0dXAiLCJ0cmFja3MiLCJ1c2VySWQiLCJwbGF5ZXJCYXIiLCJwbGF5Rmlyc3QiLCJwYWdlIiwiZXJyb3JzIiwic2lnbmVkSW4iLCJnb3RvIiwiZ2V0QnlSb2xlIiwibmFtZSIsImV4YWN0IiwiY2xpY2siLCJsb2NhdG9yIiwiZmlsbCIsInRvQmVWaXNpYmxlIiwiY291bnQiLCJnZXRCeVRleHQiLCJ0b0VxdWFsIiwic2h1ZmZsZSIsInJlcGVhdCIsInNlY29uZHMiLCJwcmVmZXJlbmNlcyIsInZvbHVtZSIsImF1dG9wbGF5IiwicG9sbCIsImV2YWx1YXRlIiwid2luZG93IiwibWVkaWFFdmVudHMiLCJmaWx0ZXIiLCJlIiwiZXZlbnQiLCJsZW5ndGgiLCJ0aW1lb3V0IiwidG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCIsInBsYXllZCIsIm1hcCIsIlVSTCIsInNyYyIsInBhdGhuYW1lIiwiU2V0Iiwic2l6ZSIsInRvQmUiLCJzbGljZSIsImdldEJ5VGl0bGUiLCJ0ZXN0QXVkaW8iLCJhIiwicXVldWUiLCJwbGF5ZXIiLCJpbmRleCIsImN1cnJlbnRUaW1lIiwiZmlyc3QiLCJsYXN0IiwiYmVmb3JlIiwidG9CZUdyZWF0ZXJUaGFuIiwidG9Db250YWluVGV4dCIsInByZXNzIiwicmVsb2FkIiwidG9IYXZlVmFsdWUiLCJkYiIsImdldEJ5TGFiZWwiLCJzZWxlY3RPcHRpb24iLCJtdXNpY190cmFja3MiLCJpZCIsInBsYXlsaXN0cyIsInRyYWNrX2lkcyIsIm9uY2UiLCJkaWFsb2ciLCJhY2NlcHQiLCJwb2RjYXN0SWQiLCJjaGVjayIsInVuY2hlY2siLCJ0b0JlQ2hlY2tlZCIsInRvSGF2ZUF0dHJpYnV0ZSIsInRvSGF2ZUNvdW50IiwiaGFzVGV4dCIsImZpbmQiLCJzb3VuZHZlcnNlX2FjdGl2aXR5IiwiciIsImxpa2VkIiwiZmFpbCIsIndpZHRoIiwiaGVpZ2h0Iiwic2V0Vmlld3BvcnRTaXplIiwicGF0aCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic2Nyb2xsV2lkdGgiLCJpbm5lcldpZHRoIiwib3ZlcmZsb3ciLCJlbCIsImNsaWVudFdpZHRoIiwic2NyZWVuc2hvdCIsInB1c2giLCJ1c2VyX2lkIiwicmV2aXNpb24iLCJjYXJkIiwiYWRkSW5pdFNjcmlwdCIsIm5hdGl2ZVBsYXkiLCJIVE1MTWVkaWFFbGVtZW50IiwicHJvdG90eXBlIiwicGxheSIsInJlamVjdGVkIiwiUHJvbWlzZSIsInJlamVjdCIsIkRPTUV4Y2VwdGlvbiIsImNhbGwiLCJyb3V0ZSIsImZ1bGZpbGwiLCJzdGF0dXMiLCJib2R5Iiwic2F2ZWQiLCJKU09OIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiZGlydHkiLCJPYmplY3QiLCJ2YWx1ZXMiLCJyb3dzIiwibGlzdGVuZWRfc2Vjb25kcyIsInRpdGxlIiwibiIsImFkbWluIiwicm93IiwidCIsInB1Ymxpc2hlZCIsInNvbWUiLCJ0b0JlSW5WaWV3cG9ydCIsImZ1bGxQYWdlIiwia2V5Ym9hcmQiLCJhY3RpdmVFbGVtZW50IiwiY2xvc2VzdCJdLCJzb3VyY2VzIjpbInYyLnNwZWMuanMiXSwic291cmNlc0NvbnRlbnQiOlsi77u/aW1wb3J0IHsgdGVzdCwgZXhwZWN0IH0gZnJvbSAnQHBsYXl3cmlnaHQvdGVzdCdcbmltcG9ydCB7IHNldHVwLCB0cmFja3MsIHVzZXJJZCwgcGxheWVyQmFyLCBwbGF5Rmlyc3QgfSBmcm9tICcuL2ZpeHR1cmVzJ1xuXG50ZXN0KCdsYW5kaW5nLCBsb2dpbiwgcmVnaXN0cmF0aW9uIGNvbmZpcm1hdGlvbiBhbmQgYXV0aGVudGljYXRlZCByb3V0ZXMnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgY29uc3QgeyBlcnJvcnMgfSA9IGF3YWl0IHNldHVwKHBhZ2UsIHsgc2lnbmVkSW46IGZhbHNlIH0pXG4gIGF3YWl0IHBhZ2UuZ290bygnLycpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdMb2cgSW4nLCBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignaW5wdXRbdHlwZT1lbWFpbF0nKS5maWxsKCdsaXN0ZW5lckBleGFtcGxlLnRlc3QnKVxuICBhd2FpdCBwYWdlLmxvY2F0b3IoJ2lucHV0W3R5cGU9cGFzc3dvcmRdJykuZmlsbCgnZml4dHVyZS1wYXNzd29yZCcpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdkaWFsb2cnKS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ0xvZyBJbicsIGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UubG9jYXRvcignLnYyLXRvcGJhcicpKS50b0JlVmlzaWJsZSgpXG4gIGF3YWl0IHBhZ2UuZ290bygnL3NldHRpbmdzJyk7IGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdMb2cgb3V0JyB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnU3RhcnQgTGlzdGVuaW5nIE5vdycgfSkpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ1NpZ24gVXAnLCBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGlmIChhd2FpdCBwYWdlLmdldEJ5Um9sZSgnaGVhZGluZycsIHsgbmFtZTogJ1dlbGNvbWUgQmFjaycgfSkuY291bnQoKSkgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ1NpZ24gdXAnLCBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignaW5wdXRbdHlwZT10ZXh0XScpLmZpbGwoJ05ldyBsaXN0ZW5lcicpXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignaW5wdXRbdHlwZT1lbWFpbF0nKS5maWxsKCduZXdAZXhhbXBsZS50ZXN0JylcbiAgYXdhaXQgcGFnZS5sb2NhdG9yKCdpbnB1dFt0eXBlPXBhc3N3b3JkXScpLmZpbGwoJ2ZpeHR1cmUtcGFzc3dvcmQnKVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnZGlhbG9nJykuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdTaWduIFVwJywgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoJ0NoZWNrIHlvdXIgZW1haWwgdG8gY29uZmlybSB5b3VyIGFjY291bnQsIHRoZW4gbG9nIGluLicpKS50b0JlVmlzaWJsZSgpXG4gIGV4cGVjdChlcnJvcnMpLnRvRXF1YWwoW10pXG59KVxuXG5mb3IgKGNvbnN0IHNodWZmbGUgb2YgW2ZhbHNlLCB0cnVlXSkgZm9yIChjb25zdCByZXBlYXQgb2YgWydub25lJywgJ29uZScsICdhbGwnXSkge1xuICB0ZXN0KGBuYXR1cmFsIGVuZGluZ3M6IHNodWZmbGU9JHtzaHVmZmxlfSwgcmVwZWF0PSR7cmVwZWF0fWAsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICAgIGNvbnN0IHsgZXJyb3JzIH0gPSBhd2FpdCBzZXR1cChwYWdlLCB7IHNlY29uZHM6IDEuMiwgcHJlZmVyZW5jZXM6IHsgdm9sdW1lOiAuMSwgc2h1ZmZsZSwgcmVwZWF0LCBhdXRvcGxheTogdHJ1ZSB9IH0pXG4gICAgYXdhaXQgcGxheUZpcnN0KHBhZ2UpXG4gICAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cubWVkaWFFdmVudHMuZmlsdGVyKGUgPT4gZS5ldmVudCA9PT0gJ2VuZGVkJykubGVuZ3RoKSwgeyB0aW1lb3V0OiAxMjAwMCB9KS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDMpXG4gICAgY29uc3QgcGxheWVkID0gYXdhaXQgcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cubWVkaWFFdmVudHMuZmlsdGVyKGUgPT4gZS5ldmVudCA9PT0gJ3BsYXlpbmcnKS5tYXAoZSA9PiBuZXcgVVJMKGUuc3JjKS5wYXRobmFtZSkpXG4gICAgaWYgKHJlcGVhdCA9PT0gJ29uZScpIGV4cGVjdChuZXcgU2V0KHBsYXllZCkuc2l6ZSkudG9CZSgxKVxuICAgIGVsc2UgaWYgKCFzaHVmZmxlKSBleHBlY3QocGxheWVkLnNsaWNlKDAsIDMpKS50b0VxdWFsKFsnL3Rlc3QtYXVkaW8vMS53YXYnLCAnL3Rlc3QtYXVkaW8vMi53YXYnLCAnL3Rlc3QtYXVkaW8vMy53YXYnXSlcbiAgICBlbHNlIGV4cGVjdChuZXcgU2V0KHBsYXllZC5zbGljZSgwLCAzKSkuc2l6ZSkudG9CZSgzKVxuICAgIGlmIChyZXBlYXQgPT09ICdub25lJykgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQbGF5JywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxuICAgIGlmIChyZXBlYXQgPT09ICdhbGwnKSBhd2FpdCBleHBlY3QucG9sbCgoKSA9PiBwYWdlLmV2YWx1YXRlKCgpID0+IHdpbmRvdy5tZWRpYUV2ZW50cy5maWx0ZXIoZSA9PiBlLmV2ZW50ID09PSAncGxheWluZycpLmxlbmd0aCkpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoNClcbiAgICBleHBlY3QoYXdhaXQgcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cudGVzdEF1ZGlvLmZpbHRlcihhID0+IGEuc3JjKS5sZW5ndGgpKS50b0JlKDEpXG4gICAgZXhwZWN0KGVycm9ycykudG9FcXVhbChbXSlcbiAgfSlcbn1cbnRlc3QoJ3JlcGVhdC1hbGwgcmVzdGFydHMgYSBvbmUtaXRlbSBxdWV1ZSwgZHVwbGljYXRlcyBhZHZhbmNlIGFuZCByZXN0b3JhdGlvbiBzdGF5cyBwYXVzZWQnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgY29uc3QgcXVldWUgPSBbdHJhY2tzKDEpWzBdLCB0cmFja3MoMSlbMF1dXG4gIGF3YWl0IHNldHVwKHBhZ2UsIHsgcGxheWVyOiB7IHF1ZXVlLCBpbmRleDogMCwgY3VycmVudFRpbWU6IDAgfSwgcHJlZmVyZW5jZXM6IHsgdm9sdW1lOiAuMSwgcmVwZWF0OiAnYWxsJywgc2h1ZmZsZTogZmFsc2UsIGF1dG9wbGF5OiB0cnVlIH0gfSlcbiAgYXdhaXQgcGFnZS5nb3RvKCcvbXVzaWMnKVxuICBhd2FpdCBleHBlY3QocGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BsYXknLCB7IGV4YWN0OiB0cnVlIH0pKS50b0JlVmlzaWJsZSgpXG4gIGV4cGVjdChhd2FpdCBwYWdlLmV2YWx1YXRlKCgpID0+IHdpbmRvdy5tZWRpYUV2ZW50cy5maWx0ZXIoZSA9PiBlLmV2ZW50ID09PSAncGxheWluZycpLmxlbmd0aCkpLnRvQmUoMClcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BsYXknLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cubWVkaWFFdmVudHMuZmlsdGVyKGUgPT4gZS5ldmVudCA9PT0gJ2VuZGVkJykubGVuZ3RoKSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgyKVxuICBhd2FpdCBwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnT3BlbiBOb3cgUGxheWluZycsIHsgZXhhY3Q6IHRydWUgfSkuZmlyc3QoKS5jbGljaygpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdSZW1vdmUgVHJhY2sgMSBmcm9tIHF1ZXVlJywgZXhhY3Q6IHRydWUgfSkubGFzdCgpLmNsaWNrKClcbiAgY29uc3QgYmVmb3JlID0gYXdhaXQgcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cubWVkaWFFdmVudHMuZmlsdGVyKGUgPT4gZS5ldmVudCA9PT0gJ2VuZGVkJykubGVuZ3RoKVxuICBhd2FpdCBleHBlY3QucG9sbCgoKSA9PiBwYWdlLmV2YWx1YXRlKCgpID0+IHdpbmRvdy5tZWRpYUV2ZW50cy5maWx0ZXIoZSA9PiBlLmV2ZW50ID09PSAnZW5kZWQnKS5sZW5ndGgpKS50b0JlR3JlYXRlclRoYW4oYmVmb3JlKVxufSlcbnRlc3QoJ3F1ZXVlIHJlbW92YWwsIHNlZWssIHBhdXNlLCB2b2x1bWUgYW5kIHJlZnJlc2ggcGVyc2lzdGVuY2UnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgY29uc3QgeyBlcnJvcnMgfSA9IGF3YWl0IHNldHVwKHBhZ2UpXG4gIGF3YWl0IHBsYXlGaXJzdChwYWdlKVxuICBhd2FpdCBwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnTmV4dCcsIHsgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGxheWVyQmFyKHBhZ2UpKS50b0NvbnRhaW5UZXh0KCdUcmFjayAyJylcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BhdXNlJywgeyBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVJvbGUoJ3NsaWRlcicsIHsgbmFtZTogJ1BsYXliYWNrIHBvc2l0aW9uJyB9KS5wcmVzcygnQXJyb3dSaWdodCcpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdPcGVuIE5vdyBQbGF5aW5nJywgeyBleGFjdDogdHJ1ZSB9KS5maXJzdCgpLmNsaWNrKClcbiAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ1JlbW92ZSBUcmFjayAxIGZyb20gcXVldWUnLCBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkpLnRvQ29udGFpblRleHQoJ1RyYWNrIDInKVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnUmVtb3ZlIFRyYWNrIDIgZnJvbSBxdWV1ZScsIGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9Db250YWluVGV4dCgnVHJhY2sgMycpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlUaXRsZSgnQ2xvc2UnLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5Um9sZSgnc2xpZGVyJywgeyBuYW1lOiAnVm9sdW1lJywgZXhhY3Q6IHRydWUgfSkuZmlsbCgnMC4zNScpXG4gIGF3YWl0IHBhZ2UucmVsb2FkKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9Db250YWluVGV4dCgnVHJhY2sgMycpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnUGxheScsIHsgZXhhY3Q6IHRydWUgfSkpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKS5nZXRCeVJvbGUoJ3NsaWRlcicsIHsgbmFtZTogJ1ZvbHVtZScsIGV4YWN0OiB0cnVlIH0pKS50b0hhdmVWYWx1ZSgnMC4zNScpXG4gIGV4cGVjdChlcnJvcnMpLnRvRXF1YWwoW10pXG59KVxudGVzdCgncGxheWxpc3QgQ1JVRCwgc29uZyBvcmRlcmluZyBhbmQgcHJvZmlsZSBwZXJzaXN0IHRocm91Z2ggcmVmcmVzaCcsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICBjb25zdCB7IGRiLCBlcnJvcnMgfSA9IGF3YWl0IHNldHVwKHBhZ2UpXG4gIGF3YWl0IHBhZ2UuZ290bygnL2xpYnJhcnknKVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnQ3JlYXRlIHBsYXlsaXN0JywgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoJ05hbWUnLCB7IGV4YWN0OiB0cnVlIH0pLmZpbGwoJ1JvYWQgdHJpcCcpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbCgnRGVzY3JpcHRpb24nLCB7IGV4YWN0OiB0cnVlIH0pLmZpbGwoJ1NvbmdzIGZvciB0aGUgcm9hZCcpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdTYXZlIHBsYXlsaXN0JyB9KS5jbGljaygpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbCgnQWRkIHNvbmcnLCB7IGV4YWN0OiB0cnVlIH0pLnNlbGVjdE9wdGlvbihkYi5tdXNpY190cmFja3NbMF0uaWQpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbCgnQWRkIHNvbmcnLCB7IGV4YWN0OiB0cnVlIH0pLnNlbGVjdE9wdGlvbihkYi5tdXNpY190cmFja3NbMV0uaWQpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdNb3ZlIFRyYWNrIDIgdXAnIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gZGIucGxheWxpc3RzWzBdPy50cmFja19pZHNbMF0pLnRvQmUoZGIubXVzaWNfdHJhY2tzWzFdLmlkKVxuICBhd2FpdCBwYWdlLnJlbG9hZCgpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnaGVhZGluZycsIHsgbmFtZTogJ1JvYWQgdHJpcCcgfSkpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ1BsYXkgcGxheWxpc3QnIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9Db250YWluVGV4dCgnVHJhY2sgMicpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdFZGl0IHBsYXlsaXN0JyB9KS5jbGljaygpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbCgnTmFtZScsIHsgZXhhY3Q6IHRydWUgfSkuZmlsbCgnUm9hZCB0cmlwIGVkaXRlZCcpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdTYXZlIHBsYXlsaXN0JyB9KS5jbGljaygpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdSZW1vdmUgVHJhY2sgMScsIGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgcGFnZS5vbmNlKCdkaWFsb2cnLCBkaWFsb2cgPT4gZGlhbG9nLmFjY2VwdCgpKVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnRGVsZXRlIHBsYXlsaXN0JyB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdC5wb2xsKCgpID0+IGRiLnBsYXlsaXN0cy5sZW5ndGgpLnRvQmUoMClcbiAgYXdhaXQgcGFnZS5nb3RvKCcvcHJvZmlsZScpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdFZGl0IHByb2ZpbGUnIH0pLmNsaWNrKClcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdEaXNwbGF5IG5hbWUnKS5maWxsKCdVcGRhdGVkIGxpc3RlbmVyJylcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdVc2VybmFtZScsIHsgZXhhY3Q6IHRydWUgfSkuZmlsbCgndXBkYXRlZF9saXN0ZW5lcicpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdTYXZlIHByb2ZpbGUnIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXh0KCdQcm9maWxlIHNhdmVkJykpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgcGFnZS5yZWxvYWQoKVxuICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoJ2hlYWRpbmcnLCB7IG5hbWU6ICdVcGRhdGVkIGxpc3RlbmVyJyB9KSkudG9CZVZpc2libGUoKVxuICBleHBlY3QoZXJyb3JzKS50b0VxdWFsKFtdKVxufSlcbnRlc3QoJ3NldHRpbmdzLCBmaWx0ZXJpbmcsIHNlYXJjaCBhbmQgcG9kY2FzdCBwYXVzZS9yZXN1bWUnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgY29uc3QgeyBwb2RjYXN0SWQsIGVycm9ycyB9ID0gYXdhaXQgc2V0dXAocGFnZSlcbiAgYXdhaXQgcGFnZS5nb3RvKCcvc2V0dGluZ3MnKVxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoJ1NodWZmbGUnLCB7IGV4YWN0OiB0cnVlIH0pLmNoZWNrKClcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdSZXBlYXQnLCB7IGV4YWN0OiB0cnVlIH0pLnNlbGVjdE9wdGlvbignb25lJylcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdBdXRvbWF0aWNhbGx5IHBsYXkgbmV4dCcpLnVuY2hlY2soKVxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoJ1RoZW1lJykuc2VsZWN0T3B0aW9uKCdsaWdodCcpXG4gIGF3YWl0IHBhZ2UucmVsb2FkKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlMYWJlbCgnU2h1ZmZsZScsIHsgZXhhY3Q6IHRydWUgfSkpLnRvQmVDaGVja2VkKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlMYWJlbCgnUmVwZWF0JywgeyBleGFjdDogdHJ1ZSB9KSkudG9IYXZlVmFsdWUoJ29uZScpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmxvY2F0b3IoJ2h0bWwnKSkudG9IYXZlQXR0cmlidXRlKCdkYXRhLXRoZW1lJywnbGlnaHQnKVxuICBhd2FpdCBwYWdlLmdvdG8oJy9tdXNpYycpOyBhd2FpdCBwYWdlLmdldEJ5Um9sZSgndGFiJywgeyBuYW1lOiAnUm9jaycsIGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UubG9jYXRvcignLnYyLXByZW1pdW0tY2FyZCcpKS50b0hhdmVDb3VudCgxKVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgndGV4dGJveCcsIHsgbmFtZTogJ1NlYXJjaCBsaWJyYXJ5JyB9KS5maWxsKCdUcmFjayAzJylcbiAgYXdhaXQgZXhwZWN0KHBhZ2UubG9jYXRvcignLnYyLXNlYXJjaC1yZXN1bHRzJykpLnRvQ29udGFpblRleHQoJ1RyYWNrIDMnKVxuICBhd2FpdCBwYWdlLmdvdG8oYC9wb2RjYXN0cy8ke3BvZGNhc3RJZH1gKVxuICBhd2FpdCBwYWdlLmxvY2F0b3IoJy52Mi1lcC1yb3cnKS5maWx0ZXIoeyBoYXNUZXh0OiAnRXBpc29kZSAyJyB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkpLnRvQ29udGFpblRleHQoJ0VwaXNvZGUgMicpXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignLnYyLWVwLXJvdycpLmZpbHRlcih7IGhhc1RleHQ6ICdFcGlzb2RlIDInIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQbGF5JywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxuICBleHBlY3QoZXJyb3JzKS50b0VxdWFsKFtdKVxufSlcbnRlc3QoJ2Zhdm9yaXRlcyBhbmQgcmVhbCBoaXN0b3J5IHN1cnZpdmUgcmVmcmVzaDsgbG9nb3V0IGNsZWFycyBwcml2YXRlIFVJIGFuZCBhdWRpbycsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICBjb25zdCB7IGRiLCBlcnJvcnMgfSA9IGF3YWl0IHNldHVwKHBhZ2UpXG4gIGF3YWl0IHBsYXlGaXJzdChwYWdlKVxuICBhd2FpdCBleHBlY3QucG9sbCgoKSA9PiBwYWdlLmV2YWx1YXRlKCgpID0+IHdpbmRvdy50ZXN0QXVkaW8uZmluZChhID0+IGEuc3JjKT8uY3VycmVudFRpbWUgfHwgMCkpLnRvQmVHcmVhdGVyVGhhbigxKVxuICBhd2FpdCBwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnRmF2b3JpdGUnLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BhdXNlJywgeyBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdC5wb2xsKCgpID0+IGRiLnNvdW5kdmVyc2VfYWN0aXZpdHkuZmlsdGVyKHIgPT4gci5saWtlZCkubGVuZ3RoKS50b0JlKDEpXG4gIGF3YWl0IHBhZ2UuZ290bygnL2xpYnJhcnknKTsgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKCdoZWFkaW5nJywgeyBuYW1lOiAnTGlzdGVuaW5nIGhpc3RvcnknIH0pKS50b0JlVmlzaWJsZSgpXG4gIGF3YWl0IHBhZ2UucmVsb2FkKCk7IGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnaGVhZGluZycsIHsgbmFtZTogJ0Zhdm9yaXRlIGNvbnRlbnQnIH0pLmxvY2F0b3IoJy4uJykpLnRvQ29udGFpblRleHQoJ1RyYWNrIDEnKVxuICBhd2FpdCBwYWdlLmdvdG8oJy9zZXR0aW5ncycpOyBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnTG9nIG91dCcgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGFnZS5sb2NhdG9yKCcudjItcGxheWVyLWJhcicpKS50b0hhdmVDb3VudCgwKVxuICBleHBlY3QoYXdhaXQgcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cudGVzdEF1ZGlvLmZpbHRlcihhID0+IGEuc3JjKS5sZW5ndGgpKS50b0JlKDApXG4gIGV4cGVjdChlcnJvcnMpLnRvRXF1YWwoW10pXG59KVxudGVzdCgnY2F0YWxvZyBmYWlsdXJlcyBhbmQgYWRtaW4gZGVuaWFsIHJlbWFpbiB2aXNpYmxlIHdpdGhvdXQgY3Jhc2hlcycsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICBjb25zdCB7IGVycm9ycyB9ID0gYXdhaXQgc2V0dXAocGFnZSwgeyBmYWlsOiAnbXVzaWNfdHJhY2tzJyB9KVxuICBhd2FpdCBwYWdlLmdvdG8oJy9tdXNpYycpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnYWxlcnQnKSkudG9Db250YWluVGV4dCgnbXVzaWNfdHJhY2tzIHVuYXZhaWxhYmxlJylcbiAgYXdhaXQgcGFnZS5nb3RvKCcvYWRtaW4nKVxuICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoJ1lvdSBkbyBub3QgaGF2ZSBhY2Nlc3MgdG8gYWRtaW5pc3RyYXRpb24uJykpLnRvQmVWaXNpYmxlKClcbiAgZXhwZWN0KGVycm9ycykudG9FcXVhbChbXSlcbn0pXG5mb3IgKGNvbnN0IFt3aWR0aCxoZWlnaHRdIG9mIFtbMTkyMCwxMDgwXSxbMTQ0MCw5MDBdLFsxMjgwLDgwMF0sWzc2OCwxMDI0XSxbNDMwLDkzMl0sWzM5MCw4NDRdLFszNzUsODEyXV0pIHtcbiAgdGVzdChgcmVzcG9uc2l2ZSAke3dpZHRofXgke2hlaWdodH1gLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgICBjb25zdCB7IGVycm9ycyB9ID0gYXdhaXQgc2V0dXAocGFnZSlcbiAgICBhd2FpdCBwYWdlLnNldFZpZXdwb3J0U2l6ZSh7IHdpZHRoLCBoZWlnaHQgfSlcbiAgICBhd2FpdCBwbGF5Rmlyc3QocGFnZSlcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgWycvbXVzaWMnLCcvbGlicmFyeScsJy9zZXR0aW5ncycsJy9wcm9maWxlJywnL3BvZGNhc3RzJywnLyddKSB7XG4gICAgICBhd2FpdCBwYWdlLmdvdG8ocGF0aClcbiAgICAgIGF3YWl0IGV4cGVjdChwYWdlLmxvY2F0b3IoJ21haW4nKSkudG9CZVZpc2libGUoKVxuICAgICAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsV2lkdGggPD0gaW5uZXJXaWR0aCkpLnRvQmUodHJ1ZSlcbiAgICAgIGNvbnN0IG92ZXJmbG93ID0gYXdhaXQgcGFnZS5sb2NhdG9yKCcudjItbWFpbi1jb250ZW50JykuZXZhbHVhdGUoZWwgPT4gZWwuc2Nyb2xsV2lkdGggPiBlbC5jbGllbnRXaWR0aCArIDEpXG4gICAgICBleHBlY3Qob3ZlcmZsb3csIGBDb250ZW50IG92ZXJmbG93IG9uICR7cGF0aH1gKS50b0JlKGZhbHNlKVxuICAgIH1cbiAgICBhd2FpdCBwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnT3BlbiBOb3cgUGxheWluZycsIHsgZXhhY3Q6IHRydWUgfSkuZmlyc3QoKS5jbGljaygpXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UubG9jYXRvcignLnYyLW5wLWZ1bGxzY3JlZW4nKS5nZXRCeVRpdGxlKCdQbGF5JywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxuICAgIGF3YWl0IHBhZ2Uuc2NyZWVuc2hvdCh7IHBhdGg6IGBhdWRpdC9wbGF5ZXItJHt3aWR0aH14JHtoZWlnaHR9LnBuZ2AgfSlcbiAgICBleHBlY3QoZXJyb3JzKS50b0VxdWFsKFtdKVxuICB9KVxufVxyXG5cbnRlc3QoJ2F1dG9wbGF5IG9mZiBzdG9wcyBhZnRlciBhIG5hdHVyYWwgZW5kaW5nJywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gIGF3YWl0IHNldHVwKHBhZ2UsIHsgc2Vjb25kczogMSwgcHJlZmVyZW5jZXM6IHsgdm9sdW1lOiAuMSwgcmVwZWF0OiAnbm9uZScsIHNodWZmbGU6IGZhbHNlLCBhdXRvcGxheTogZmFsc2UgfSB9KVxuICBhd2FpdCBwbGF5Rmlyc3QocGFnZSlcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cubWVkaWFFdmVudHMuZmlsdGVyKGUgPT4gZS5ldmVudCA9PT0gJ2VuZGVkJykubGVuZ3RoKSkudG9CZSgxKVxuICBhd2FpdCBleHBlY3QocGxheWVyQmFyKHBhZ2UpKS50b0NvbnRhaW5UZXh0KCdUcmFjayAxJylcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQbGF5JywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxufSlcbnRlc3QoJ3BsYXkgbmV4dCBvdmVycmlkZXMgc2h1ZmZsZSwgdHJhY2sgbWVudSBmYXZvcml0ZXMgYW5kIGFkZC10by1wbGF5bGlzdCB3b3JrJywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gIGNvbnN0IHsgZGIgfSA9IGF3YWl0IHNldHVwKHBhZ2UsIHsgcHJlZmVyZW5jZXM6IHsgdm9sdW1lOiAuMSwgc2h1ZmZsZTogdHJ1ZSwgcmVwZWF0OiAnbm9uZScsIGF1dG9wbGF5OiB0cnVlIH0gfSlcbiAgZGIucGxheWxpc3RzLnB1c2goeyBpZDogJzU1NTU1NTU1LTU1NTUtNDU1NS04NTU1LTU1NTU1NTU1NTU1NScsIHVzZXJfaWQ6IHVzZXJJZCwgbmFtZTogJ1NhdmVkIHNvbmdzJywgdHJhY2tfaWRzOiBbXSwgcmV2aXNpb246IDAgfSlcbiAgYXdhaXQgcGxheUZpcnN0KHBhZ2UpXG4gIGNvbnN0IGNhcmQgPSBwYWdlLmxvY2F0b3IoJy52Mi1wcmVtaXVtLWNhcmQnKS5maWx0ZXIoeyBoYXNUZXh0OiAnVHJhY2sgMycgfSlcbiAgYXdhaXQgY2FyZC5nZXRCeUxhYmVsKCdBY3Rpb25zIGZvciBUcmFjayAzJykuY2xpY2soKVxuICBhd2FpdCBjYXJkLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnUGxheSBuZXh0JywgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBjYXJkLmdldEJ5TGFiZWwoJ0FkZCBUcmFjayAzIHRvIHBsYXlsaXN0Jykuc2VsZWN0T3B0aW9uKGRiLnBsYXlsaXN0c1swXS5pZClcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gZGIucGxheWxpc3RzWzBdLnRyYWNrX2lkcy5sZW5ndGgpLnRvQmUoMSlcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ05leHQnLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9Db250YWluVGV4dCgnVHJhY2sgMycpXG59KVxudGVzdCgncGxheWJhY2sgcmVqZWN0aW9uIGFuZCBmYWlsZWQgbWVkaWEgc2hvdyByZWNvdmVyYWJsZSBlcnJvcnMnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgY29uc3QgeyBlcnJvcnMgfSA9IGF3YWl0IHNldHVwKHBhZ2UpXG4gIGF3YWl0IHBhZ2UuYWRkSW5pdFNjcmlwdCgoKSA9PiB7XG4gICAgY29uc3QgbmF0aXZlUGxheSA9IEhUTUxNZWRpYUVsZW1lbnQucHJvdG90eXBlLnBsYXlcbiAgICBsZXQgcmVqZWN0ZWQgPSBmYWxzZVxuICAgIEhUTUxNZWRpYUVsZW1lbnQucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghcmVqZWN0ZWQpIHsgcmVqZWN0ZWQgPSB0cnVlOyByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IERPTUV4Y2VwdGlvbignQmxvY2tlZCBmaXh0dXJlJywgJ05vdEFsbG93ZWRFcnJvcicpKSB9XG4gICAgICByZXR1cm4gbmF0aXZlUGxheS5jYWxsKHRoaXMpXG4gICAgfVxuICB9KVxuICBhd2FpdCBwYWdlLmdvdG8oJy9tdXNpYycpXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignLnYyLXByZW1pdW0tY2FyZCcpLmZpbHRlcih7IGhhc1RleHQ6ICdUcmFjayAxJyB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnYWxlcnQnKSkudG9Db250YWluVGV4dCgnUGxheWJhY2sgd2FzIGJsb2NrZWQnKVxuICBhd2FpdCBwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnUGxheScsIHsgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BhdXNlJywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxuICBhd2FpdCBwYWdlLnJvdXRlKCcqKi90ZXN0LWF1ZGlvLzIud2F2PyoqJywgcm91dGUgPT4gcm91dGUuZnVsZmlsbCh7IHN0YXR1czogNDA0LCBib2R5OiAnTm90IGZvdW5kJyB9KSlcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ05leHQnLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKCdhbGVydCcpKS50b0NvbnRhaW5UZXh0KC9BdWRpbyBjb3VsZCBub3QgYmUgbG9hZGVkfFVuYWJsZSB0byBwbGF5LylcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ05leHQnLCB7IGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9Db250YWluVGV4dCgnVHJhY2sgMycpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnUGF1c2UnLCB7IGV4YWN0OiB0cnVlIH0pKS50b0JlVmlzaWJsZSgpXG4gIGV4cGVjdChlcnJvcnMpLnRvRXF1YWwoW10pXG59KVxudGVzdCgnb2ZmbGluZSBhY3Rpdml0eSBwZXJzaXN0cyBsb2NhbGx5IGFuZCByZXBvcnRzIGNsb3VkIGZhaWx1cmUnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgYXdhaXQgc2V0dXAocGFnZSwgeyBmYWlsOiAnc291bmR2ZXJzZV9hY3Rpdml0eScgfSlcbiAgYXdhaXQgcGxheUZpcnN0KHBhZ2UpXG4gIGF3YWl0IGV4cGVjdC5wb2xsKCgpID0+IHBhZ2UuZXZhbHVhdGUoKCkgPT4gd2luZG93LnRlc3RBdWRpby5maW5kKGEgPT4gYS5zcmMpPy5jdXJyZW50VGltZSB8fCAwKSkudG9CZUdyZWF0ZXJUaGFuKDEpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdGYXZvcml0ZScsIHsgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoJ3N0YXR1cycpKS50b0NvbnRhaW5UZXh0KCdjbG91ZCBzeW5jIGZhaWxlZCcpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQYXVzZScsIHsgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBwYWdlLnJlbG9hZCgpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnUmVtb3ZlIGZhdm9yaXRlJywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxuICBjb25zdCBzYXZlZCA9IGF3YWl0IHBhZ2UuZXZhbHVhdGUoaWQgPT4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShgc291bmR2ZXJzZV9hY3Rpdml0eToke2lkfWApKSwgdXNlcklkKVxuICBleHBlY3Qoc2F2ZWQuZGlydHkubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMClcbiAgZXhwZWN0KE9iamVjdC52YWx1ZXMoc2F2ZWQucm93cylbMF0ubGlzdGVuZWRfc2Vjb25kcykudG9CZUdyZWF0ZXJUaGFuKDApXG59KVxudGVzdCgnY29ycnVwdCBzdG9yYWdlIGRvZXMgbm90IGNyYXNoIGFuZCBlbXB0eSBxdWV1ZSBzdGF5cyBlbXB0eSBhZnRlciByZWZyZXNoJywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gIGNvbnN0IHsgZXJyb3JzIH0gPSBhd2FpdCBzZXR1cChwYWdlLCB7IHByZWZlcmVuY2VzOiB7IHZvbHVtZTogJ2JhZCcsIHJlcGVhdDogJ2JvZ3VzJywgc2h1ZmZsZTogJ2JhZCcgfSwgcGxheWVyOiB7IHF1ZXVlOiBbeyBpZDoge30sIHRpdGxlOiB7fSB9XSwgaW5kZXg6IC0xMDAgfSB9KVxuICBhd2FpdCBwYWdlLmdvdG8oJy9tdXNpYycpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmxvY2F0b3IoJy52Mi1wcmVtaXVtLWNhcmQnKSkudG9IYXZlQ291bnQoMylcbiAgYXdhaXQgcGFnZS5sb2NhdG9yKCcudjItcHJlbWl1bS1jYXJkJykuZmlsdGVyKHsgaGFzVGV4dDogJ1RyYWNrIDEnIH0pLmNsaWNrKClcbiAgYXdhaXQgcGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ09wZW4gTm93IFBsYXlpbmcnLCB7IGV4YWN0OiB0cnVlIH0pLmZpcnN0KCkuY2xpY2soKVxuICBmb3IgKGNvbnN0IG4gb2YgWzMsMiwxXSkgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogYFJlbW92ZSBUcmFjayAke259IGZyb20gcXVldWVgLCBleGFjdDogdHJ1ZSB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkpLnRvSGF2ZUNvdW50KDApXG4gIGF3YWl0IHBhZ2UucmVsb2FkKCk7IGF3YWl0IGV4cGVjdChwYWdlLmxvY2F0b3IoJy52Mi1wcmVtaXVtLWNhcmQnKSkudG9IYXZlQ291bnQoMylcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKSkudG9IYXZlQ291bnQoMClcbiAgZXhwZWN0KGVycm9ycykudG9FcXVhbChbXSlcbn0pXG50ZXN0KCdwb2RjYXN0IHJlc3VtZSByZXN0b3JlcyB0aGUgc2F2ZWQgb2Zmc2V0IGFmdGVyIG1ldGFkYXRhIGxvYWRzJywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gIGNvbnN0IHsgcG9kY2FzdElkIH0gPSBhd2FpdCBzZXR1cChwYWdlLCB7IHNlY29uZHM6IDMwIH0pXG4gIGF3YWl0IHBhZ2UuZ290byhgL3BvZGNhc3RzLyR7cG9kY2FzdElkfWApXG4gIGF3YWl0IHBhZ2UubG9jYXRvcignLnYyLWVwLXJvdycpLmZpbHRlcih7IGhhc1RleHQ6ICdFcGlzb2RlIDEnIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQYXVzZScsIHsgZXhhY3Q6IHRydWUgfSkpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cudGVzdEF1ZGlvLmZpbmQoYSA9PiBhLnNyYyk/LmN1cnJlbnRUaW1lIHx8IDApKS50b0JlR3JlYXRlclRoYW4oLjMpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVJvbGUoJ3NsaWRlcicsIHsgbmFtZTogJ1BsYXliYWNrIHBvc2l0aW9uJyB9KS5wcmVzcygnQXJyb3dSaWdodCcpXG4gIGF3YWl0IHBsYXllckJhcihwYWdlKS5nZXRCeVRpdGxlKCdQYXVzZScsIHsgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QucG9sbCgoKSA9PiBwYWdlLmV2YWx1YXRlKCgpID0+IHdpbmRvdy50ZXN0QXVkaW8uZmluZChhID0+IGEuc3JjKT8uY3VycmVudFRpbWUgfHwgMCkpLnRvQmVHcmVhdGVyVGhhbig1KVxuICBhd2FpdCBwYWdlLnJlbG9hZCgpXG4gIGF3YWl0IGV4cGVjdChwbGF5ZXJCYXIocGFnZSkuZ2V0QnlUaXRsZSgnUGxheScsIHsgZXhhY3Q6IHRydWUgfSkpLnRvQmVWaXNpYmxlKClcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiB3aW5kb3cudGVzdEF1ZGlvLmZpbmQoYSA9PiBhLnNyYyk/LmN1cnJlbnRUaW1lIHx8IDApKS50b0JlR3JlYXRlclRoYW4oNSlcbiAgYXdhaXQgcGFnZS5sb2NhdG9yKCcudjItZXAtcm93JykuZmlsdGVyKHsgaGFzVGV4dDogJ0VwaXNvZGUgMScgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QocGxheWVyQmFyKHBhZ2UpLmdldEJ5VGl0bGUoJ1BhdXNlJywgeyBleGFjdDogdHJ1ZSB9KSkudG9CZVZpc2libGUoKVxufSlcbnRlc3QoJ2FkbWluIGNyZWF0ZXMsIGVkaXRzLCBwdWJsaXNoZXMgYW5kIGRlbGV0ZXMgY2F0YWxvZyBjb250ZW50JywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gIGNvbnN0IHsgZGIsIGVycm9ycyB9ID0gYXdhaXQgc2V0dXAocGFnZSwgeyBhZG1pbjogdHJ1ZSB9KVxuICBhd2FpdCBwYWdlLmdvdG8oJy9hZG1pbicpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdBZGQgY29udGVudCcgfSkuY2xpY2soKVxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoJ3RpdGxlJywgeyBleGFjdDogdHJ1ZSB9KS5maWxsKCdBZG1pbiBzb25nJylcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdhdWRpbyB1cmwnLCB7IGV4YWN0OiB0cnVlIH0pLmZpbGwoJ2h0dHBzOi8vZXhhbXBsZS50ZXN0L3NvbmcubXAzJylcbiAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoJ2J1dHRvbicsIHsgbmFtZTogJ1NhdmUgY29udGVudCcgfSkuY2xpY2soKVxuICBjb25zdCByb3cgPSBwYWdlLmxvY2F0b3IoJy52Mi1tZWRpYS1yb3cnKS5maWx0ZXIoeyBoYXNUZXh0OiAnQWRtaW4gc29uZycgfSlcbiAgYXdhaXQgZXhwZWN0KHJvdykudG9CZVZpc2libGUoKVxuICBhd2FpdCByb3cuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdQdWJsaXNoJywgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBleHBlY3QucG9sbCgoKSA9PiBkYi5tdXNpY190cmFja3MuZmluZCh0ID0+IHQudGl0bGUgPT09ICdBZG1pbiBzb25nJyk/LnB1Ymxpc2hlZCkudG9CZSh0cnVlKVxuICBhd2FpdCByb3cuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdFZGl0JywgZXhhY3Q6IHRydWUgfSkuY2xpY2soKVxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoJ3RpdGxlJywgeyBleGFjdDogdHJ1ZSB9KS5maWxsKCdFZGl0ZWQgc29uZycpXG4gIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKCdidXR0b24nLCB7IG5hbWU6ICdTYXZlIGNvbnRlbnQnIH0pLmNsaWNrKClcbiAgcGFnZS5vbmNlKCdkaWFsb2cnLCBkaWFsb2cgPT4gZGlhbG9nLmFjY2VwdCgpKVxuICBhd2FpdCBwYWdlLmxvY2F0b3IoJy52Mi1tZWRpYS1yb3cnKS5maWx0ZXIoeyBoYXNUZXh0OiAnRWRpdGVkIHNvbmcnIH0pLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnRGVsZXRlJyB9KS5jbGljaygpXG4gIGF3YWl0IGV4cGVjdC5wb2xsKCgpID0+IGRiLm11c2ljX3RyYWNrcy5zb21lKHQgPT4gdC50aXRsZSA9PT0gJ0VkaXRlZCBzb25nJykpLnRvQmUoZmFsc2UpXG4gIGV4cGVjdChlcnJvcnMpLnRvRXF1YWwoW10pXG59KVxudGVzdCgnc3RhbGUgcGxheWxpc3QgdXBkYXRlcyBzaG93IGEgY29uZmxpY3QgaW5zdGVhZCBvZiBvdmVyd3JpdGluZycsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICBjb25zdCB7IGRiIH0gPSBhd2FpdCBzZXR1cChwYWdlKVxuICBjb25zdCBpZCA9ICc1NTU1NTU1NS01NTU1LTQ1NTUtODU1NS01NTU1NTU1NTU1NTUnXG4gIGRiLnBsYXlsaXN0cy5wdXNoKHsgaWQsIHVzZXJfaWQ6IHVzZXJJZCwgbmFtZTogJ1NoYXJlZCBhY3Jvc3MgdGFicycsIHRyYWNrX2lkczogW10sIHJldmlzaW9uOiAwIH0pXG4gIGF3YWl0IHBhZ2UuZ290byhgL2xpYnJhcnk/cGxheWxpc3Q9JHtpZH1gKVxuICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoJ2hlYWRpbmcnLCB7IG5hbWU6ICdTaGFyZWQgYWNyb3NzIHRhYnMnIH0pKS50b0JlVmlzaWJsZSgpXG4gIGRiLnBsYXlsaXN0c1swXS5yZXZpc2lvbiA9IDFcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKCdBZGQgc29uZycsIHsgZXhhY3Q6IHRydWUgfSkuc2VsZWN0T3B0aW9uKGRiLm11c2ljX3RyYWNrc1swXS5pZClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKCdhbGVydCcpKS50b0NvbnRhaW5UZXh0KCdjaGFuZ2VkIGVsc2V3aGVyZScpXG4gIGV4cGVjdChkYi5wbGF5bGlzdHNbMF0udHJhY2tfaWRzKS50b0VxdWFsKFtdKVxufSlcbnRlc3QoJ2xhbmRpbmcgYW5kIGRpYWxvZ3MgZml0IG1vYmlsZSBhbmQga2V5Ym9hcmQgZm9jdXMgc3RheXMgaW4gZGlhbG9ncycsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICBhd2FpdCBzZXR1cChwYWdlLCB7IHNpZ25lZEluOiBmYWxzZSB9KVxuICBhd2FpdCBwYWdlLnNldFZpZXdwb3J0U2l6ZSh7IHdpZHRoOiAzNzUsIGhlaWdodDogODEyIH0pXG4gIGF3YWl0IHBhZ2UuZ290bygnLycpXG4gIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnU2lnbiBVcCcsIGV4YWN0OiB0cnVlIH0pKS50b0JlSW5WaWV3cG9ydCgpXG4gIGF3YWl0IHBhZ2Uuc2NyZWVuc2hvdCh7IHBhdGg6ICdhdWRpdC9sYW5kaW5nLW1vYmlsZS5wbmcnLCBmdWxsUGFnZTogdHJ1ZSB9KVxuICBhd2FpdCBwYWdlLmdldEJ5Um9sZSgnYnV0dG9uJywgeyBuYW1lOiAnU2lnbiBVcCcsIGV4YWN0OiB0cnVlIH0pLmNsaWNrKClcbiAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKCdoZWFkaW5nJywgeyBuYW1lOiAnQ3JlYXRlIEFjY291bnQnIH0pKS50b0JlVmlzaWJsZSgpXG4gIGF3YWl0IHBhZ2Uua2V5Ym9hcmQucHJlc3MoJ1NoaWZ0K1RhYicpXG4gIGV4cGVjdChhd2FpdCBwYWdlLmV2YWx1YXRlKCgpID0+ICEhZG9jdW1lbnQuYWN0aXZlRWxlbWVudC5jbG9zZXN0KCdbcm9sZT1kaWFsb2ddJykpKS50b0JlKHRydWUpXG4gIGF3YWl0IHBhZ2Uua2V5Ym9hcmQucHJlc3MoJ0VzY2FwZScpOyBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoJ2RpYWxvZycpKS50b0hhdmVDb3VudCgwKVxufSlcclxuIl0sIm1hcHBpbmdzIjoiQUFBQyxTQUFTQSxJQUFJLEVBQUVDLE1BQU0sUUFBUSxrQkFBa0I7QUFDaEQsU0FBU0MsS0FBSyxFQUFFQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsU0FBUyxFQUFFQyxTQUFTLFFBQVEsWUFBWTtBQUV4RU4sSUFBSSxDQUFDLG9FQUFvRSxFQUFFLE9BQU87RUFBRU87QUFBSyxDQUFDLEtBQUs7RUFDN0YsTUFBTTtJQUFFQztFQUFPLENBQUMsR0FBRyxNQUFNTixLQUFLLENBQUNLLElBQUksRUFBRTtJQUFFRSxRQUFRLEVBQUU7RUFBTSxDQUFDLENBQUM7RUFDekQsTUFBTUYsSUFBSSxDQUFDRyxJQUFJLENBQUMsR0FBRyxDQUFDO0VBQ3BCLE1BQU1ILElBQUksQ0FBQ0ksU0FBUyxDQUFDLFFBQVEsRUFBRTtJQUFFQyxJQUFJLEVBQUUsUUFBUTtJQUFFQyxLQUFLLEVBQUU7RUFBSyxDQUFDLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7RUFDdkUsTUFBTVAsSUFBSSxDQUFDUSxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLHVCQUF1QixDQUFDO0VBQ3JFLE1BQU1ULElBQUksQ0FBQ1EsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUNDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztFQUNuRSxNQUFNVCxJQUFJLENBQUNJLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FB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