// Tunable domain constants. A number that means something belongs here, not
// inline at the point of use — see docs/conventions/architecture.md.

// Which week a moment falls in depends on where the users are, never on where
// the server is. Vercel runs in UTC.
export const APP_TIMEZONE = "Europe/Rome"

export const DAYS_IN_WEEK = 7

// The two people the app is for. A recipe's own servings is the source's yield;
// this is what the shopping list scales to.
export const HOUSEHOLD_SERVINGS = 2

// How far back a recipe is worth remembering when proposing a menu. Beyond
// this, "cooked four months ago" and "never cooked" say the same thing and only
// cost tokens. Recency is a preference the prompt weighs, not a filter that
// removes candidates — design document 2026-08-21 section 6.
export const RECENCY_WINDOW_WEEKS = 8

// How far apart the two legs of a transfer may be. Money between two Italian
// accounts lands in one to three days; four leaves room without pairing a
// coincidence a week later.
export const TRANSFER_WINDOW_DAYS = 4
