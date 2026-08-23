# Background photos

Three folders:

- `images/john/` — shows only while **John** is selected
- `images/mary/` — shows only while **Mary** is selected
- `images/shared/` — shows in **both** reels (photos of the two of you)

Drop photos into the right folder, then list them in `app.js`:

```js
const PEOPLE = {
  john: { ..., slides: ["images/john/venice-beach.jpg"] },
  mary: { ..., slides: ["images/mary/benefit-st.jpg"] },
};

const SHARED_SLIDES = [
  "images/shared/first-date.jpg",
  "images/shared/airport.jpg",
];
```

So John's reel is `john/` + `shared/`, and Mary's is `mary/` + `shared/`.

By default the reels are reshuffled on every page load, so the photos come up
in a different order each visit. Set `SHUFFLE_SLIDES = false` in `app.js` to
keep them in the order you listed them.

Each person can have any number of photos, and the two reels are independent —
switching people returns to the photo that person was last on.

Landscape shots around 1920px wide look best, since they're used full-screen.
If a person has no photos at all, the page falls back to a gradient background
and the arrows hide themselves.
