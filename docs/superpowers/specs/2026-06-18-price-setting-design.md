# Price Setting Feature Design

**Date:** 2026-06-18
**Scope:** Host-only price setting modal for stocks and real estate in Lobby

## Overview

Add a "가격 설정" button in the Lobby bottom bar (host only). Clicking it opens a two-step modal: first select a category (주식 or 부동산), then adjust prices for all 6 items using −/+ buttons. Prices are stored at the room level on the server and broadcast to all players via socket.

## Data Structure

Added to the `room` object in `server/rooms.js`:

```js
prices: {
  stocks: {
    semiconductor: 2000, finance: 2000, industrial: 2000,
    auto: 2000, bio: 2000, content: 2000,
  },
  realEstate: {
    gaon: 10000, nuri: 10000, dami: 10000,
    maru: 10000, chorong: 10000, hani: 10000,
  },
}
```

- **주식 range:** 2,000 ~ 20,000원 (step: 2,000)
- **부동산 range:** 10,000 ~ 100,000원 (step: 10,000)

## Server Changes

### `server/rooms.js`
- `createRoom()`: initialize `room.prices` with default values above
- `updateRoomPrices(socketId, prices)`: find room by socketId, verify player is host, update `room.prices`, return room
- `GET /api/rooms/:code` in `server/index.js`: update response to include `prices: room.prices`

### `server/index.js`
- New socket event `update-room-prices`: call `updateRoomPrices`, then `io.to(room.code).emit('room-prices-updated', { prices: room.prices })`

## UI Flow (Lobby.jsx)

1. `bottomBar` shows "가격 설정" button only when `isHost === true`
2. Click → `PriceSettingModal` opens at step 1: two image buttons (주식 / 부동산)
3. Select category → step 2: list of 6 items, each with `−` / price display / `+`
4. Confirm → emit `update-room-prices` with full prices object, close modal
5. Lobby listens to `room-prices-updated` and keeps local `prices` state updated

## Components

### `PriceSettingModal` (in Lobby.jsx)
Props: `prices`, `onConfirm(newPrices)`, `onClose`

Internal state:
- `step`: `'select' | 'stocks' | 'realEstate'`
- `tempPrices`: copy of prices being edited

Step 1 renders two category buttons with images (`/stocks.png`, `/realestate.png` or equivalent).
Step 2 renders a `quantityList`-style list with −/+ and formatted price display.

## Styling

Follow existing `IndividualPage` popup pattern:
- `overlay` → `popup` → `popupTitle` → `quantityList` → `quantityItem`
- New classes added to `Lobby.module.css`: `priceBtn`, `priceDisplay`, `categoryGrid`, `categoryCard`
- Step 1 category selection: two large clickable cards side by side

## Out of Scope

- Prices visible to non-host players (deferred to dashboard feature)
- Price history or audit log
