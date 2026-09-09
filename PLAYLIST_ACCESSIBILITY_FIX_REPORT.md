# Playlist accessibility fix report

## Change

The existing round play control in `src/features/library/LibraryPage.jsx` now
has `aria-label="Play playlist"`. It remains a native button, so its implicit
role is `button` on desktop and mobile.

Its existing click handler is unchanged:

```jsx
onClick={() => playItem(items[0], items, 0)}
```

It starts the first playlist track and supplies the full ordered playlist as
the player queue. No visible UI, music behavior, or admin code was changed.

## Verification

Command run:

```text
npx.cmd playwright test tests/v2.spec.js -g "playlist CRUD, song ordering and profile persist through refresh" --workers=1
```

The test now finds and activates `button "Play playlist"`, then confirms
`Track 2` is in the player. It next times out at an unrelated existing locator:
`button "Edit playlist"`. The current visible edit action is named `Edit`, so
the requested play-button compatibility issue is resolved, but the complete
test will need a separate accessibility label for that existing action.
