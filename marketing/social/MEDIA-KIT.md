# ÜrTC Media Kit

Everything here is generated from the real app or the real brand system. Nothing is a mockup of a feature that doesn't exist, and no fake data appears in any frame.

Regenerate any of it with the dev server running on `:5173`:

```bash
node marketing/scripts/promo-media.mjs          # everything
node marketing/scripts/promo-media.mjs cards    # just the cards
node marketing/scripts/promo-media.mjs collage  # just the collage video
node marketing/scripts/promo-media.mjs clips    # just the app recordings
```

Requires **ffmpeg** on PATH (installed via `winget install Gyan.FFmpeg`).

---

## Cards — `cards/`

Eight brand cards. Edit the copy in `cards.html` and re-render; the layout, glow, grid and type scale are all shared so new cards stay on-brand automatically.

| File | Size | Use | Line |
|---|---|---|---|
| `card-c1.png` | 1600×900 | X / LinkedIn hero | The planners have no live data. The trackers have no brain. |
| `card-c2.png` | 1600×900 | X quote card | Airlines give you a code. We give you "Delayed +45m." |
| `card-c3.png` | 1600×900 | X / LinkedIn | Apollo isn't a chatbot with a dog avatar. |
| `card-c4.png` | 1080×1080 | IG feed | One box. Everything that flies. |
| `card-c5.png` | 1080×1080 | IG feed | Built by two people. One of them worked the cabin. |
| `card-c6.png` | 1080×1350 | IG portrait | Your flight. On a real 3D Earth. |
| `card-c7.png` | 1080×1350 | IG portrait | It's alpha. Some of it is held together with hope. |
| `card-c8.png` | 1080×1080 | IG feed | Planning and live data shouldn't be two apps. |

## Video — `video/`

| File | Size | Length | What it actually shows |
|---|---|---|---|
| `collage-square.mp4` | 1080×1080 | 8.5s | Animated travel collage, a post composing itself (caption types, photos attach, likes tick up), closing on "Are you in?" — the Wander teaser, rendered as video |
| `clip-flight-3d.mp4` | 1080×1920 | 14.0s | Real capture: searching DAL1182, the photorealistic 3D Earth flying in, scrolling the flight card, flipping to satellite |
| `clip-place-sheet.mp4` | 1080×1920 | 10.7s | Real capture: tapping a place in Explore, the detail sheet springing up, scrolling through Apollo's take and genuine Google reviews |
| `clip-wander.mp4` | 1080×1920 | 13.3s | Real capture: the Wander teaser in the live app — collage lands, post types itself, scroll to "Are you in?" |

All three phone clips are **1080×1920**, the correct frame for Reels, Stories, TikTok and X video. The collage is square for the IG feed.

### Notes for posting

- The phone clips are letterboxed onto brand ink (`#08090C`) rather than stretched, so the UI stays pixel-accurate. If a platform crops, the safe area is the centre column.
- `clip-place-sheet.mp4` shows a real business with real reviews. That's a strength for credibility, but if you'd rather not feature a specific venue, re-record after searching for something else.
- `clip-flight-3d.mp4` shows a live flight number. Flight data changes daily — the clip is a recording, not a live quote. Don't caption it with a claim about that specific flight's status today.
- Nothing here shows a completed booking, because booking is still in test mode. Keep captions on booking framed as "in testing".

### A note on how these were made

`page.screencast()` looked like the obvious tool and produced garbage: it only emits a frame when pixels change, and it compresses its timeline when the UI idles, so 14 seconds of recording came out as a 1.2-second video. The clips are captured instead as timed screenshot sequences, with the achieved frame rate measured and fed to ffmpeg so playback speed is true to life. That's why each clip also *does* something the whole way through — scrolling, tapping, toggling — rather than sitting on a static screen.
