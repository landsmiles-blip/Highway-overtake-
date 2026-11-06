# Highway Overtake 3D

A 3D arcade highway driving game built with Three.js in a single HTML file.

## Features
- Realistic traffic: sedans, hatchbacks, SUVs, pickups, vans and buses
- Traffic AI with car-following, smooth acceleration/braking and lane changes
- Object pooling and distance-based LOD for smooth 60 fps on mobile
- Boost pads for a temporary burst of speed
- Difficulty that ramps up the longer you survive
- Close-call bonus for tight overtakes
- Responsive layout for phones, tablets and laptops

## Controls
- Left / Right arrows (or swipe, or on-screen buttons): change lane
- Up arrow: accelerate
- Down arrow: brake

## Run
Open `index.html` in any modern browser (needs an internet connection to load Three.js from a CDN).

## YouTube Playables build
The `playables/` folder is the bundle for YouTube Playables: `index.html` and a locally bundled `three.min.js` (no CDN or web fonts), the YouTube SDK calls (`firstFrameReady`, `gameReady`, pause/resume, score, saved best score). Zip the contents of that folder, with both files at the zip root, to submit it.
