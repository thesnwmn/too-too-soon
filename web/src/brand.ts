// The look: the engine (public/icon.svg, also the favicon and home-screen icon) and the word
// mark, "Too Too Soon" with each pair of o's drawn as driving wheels joined by a coupling rod.

/** Two wheels and a rod, standing in for "oo". Coloured by the text around it; the rod is red. */
const WHEELS = `<svg class="wheels" viewBox="0 0 100 50" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="10"><circle cx="25" cy="30" r="19"/><circle cx="75" cy="30" r="19"/></g><rect x="17" y="25" width="66" height="10" rx="5" fill="var(--buffer)"/><g fill="currentColor"><circle cx="25" cy="30" r="5"/><circle cx="75" cy="30" r="5"/></g></svg>`;

/** The word mark, read out as "Too Too Soon". Its size follows the font size it's given. */
export const wordmark = (cls = ""): string =>
  `<span class="wordmark ${cls}" role="img" aria-label="Too Too Soon">T${WHEELS}<span class="gap"></span>T${WHEELS}<span class="gap"></span>Soon</span>`;

/** The engine, beside the word mark or a spot's name. Decorative: the words say what it is. */
export const logo = `<img class="logo" src="./icon.svg" alt="" width="44" height="44">`;
