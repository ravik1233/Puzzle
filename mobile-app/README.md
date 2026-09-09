# Dinner Rush (mobile)

A thin native wrapper around the live game at https://ravik1233.github.io/Puzzle/,
so it installs like a real app instead of living only in a browser tab. It's a
single `WebView` pointed at that URL — the game itself still ships from the
main site; this project just gets it onto a phone via a scan-to-install build.

## One-time setup (needs your Expo account)

```
cd mobile-app
npx eas login          # log into your expo.dev account
npx eas init            # links this folder to a new project on your account
```

`eas init` prints a project ID and writes it into `app.json` under
`expo.extra.eas.projectId`. Once that's there, builds can be triggered by
me (via the Expo MCP connector) or by you directly.

## Build an installable app (scan-to-install, no store needed)

```
npx eas build --platform android --profile preview
```

This produces a real `.apk`. When it finishes, `eas` prints a QR code —
scanning it on an Android phone downloads and installs the app directly
(enable "install unknown apps" if prompted). iOS works the same way with
`--platform ios --profile preview`, but ad-hoc iOS installs need your
device's UDID registered to an Apple Developer account first; TestFlight
(`production` profile + `eas submit`) is the simpler path for iOS.

## Local dev (optional)

```
npm start
```

Then scan the QR with the Expo Go app to preview on your own phone while
editing `App.js`.
