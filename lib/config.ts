// Tunable domain constants. A number that means something belongs here, not
// inline at the point of use — see docs/conventions/architecture.md.

// Which week a moment falls in depends on where the users are, never on where
// the server is. Vercel runs in UTC.
export const APP_TIMEZONE = "Europe/Rome"

export const DAYS_IN_WEEK = 7

// The two people the app is for. A recipe's own servings is the source's yield;
// this is what the shopping list scales to.
export const HOUSEHOLD_SERVINGS = 2

// Recipes cooked within this many days are excluded from the candidates handed
// to the menu proposal, so the constraint cannot be argued with by a prompt.
export const DEFAULT_COOLDOWN_DAYS = 3
