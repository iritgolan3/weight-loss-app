import { contactless } from '../icons.js';

/** Card face gradients, keyed by tier. The terminal illustration draws the
    ordered card too, so these cannot live only in CSS. */
export const CARD_GRADIENTS = {
  platinum: ['#D5D4CF', '#B0AEA8', '#8E8B85'],
  silver:   ['#C9C7C0', '#A7A59D', '#827E78'],
  gold:     ['#D8C89C', '#C0AA79', '#9A8863'],
  linked:   ['#4A4A52', '#2E2E36', '#1B1B21'],
};

/** The three orderable card tiers, in carousel order. */
/**
 * The three metals, in the carousel order from the reference design.
 *
 * `rank` is the ladder — Silver below Platinum below Gold — and it is what
 * decides whether moving to another card is a step up or a step down. The
 * figures beneath it are the terms that actually differ between them, and
 * they are the numbers the app enforces: a card issued on a tier takes that
 * tier's limits, and Confirm order lists exactly what is being bought.
 */
export const TIERS = [
  {
    id: 'platinum', name: 'Platinum', price: 199, rank: 2, subtitle: 'Platinum metal',
    perTxn: 5000, daily: 25000, cashback: 1.5, fx: 0, freeAtm: 5,
  },
  {
    id: 'silver', name: 'Silver', price: 99, rank: 1, subtitle: 'Silver metal',
    perTxn: 2500, daily: 10000, cashback: 1, fx: 2.5, freeAtm: 2,
  },
  {
    id: 'gold', name: 'Gold', price: 349, rank: 3, subtitle: 'Gold metal',
    perTxn: 10000, daily: 50000, cashback: 2, fx: 0, freeAtm: -1,   // -1 = no cap
  },
];

export const tierById = id => TIERS.find(t => t.id === id) || TIERS[0];

/** Where a card sits on the ladder. Added cards rank below every metal. */
export const rankOf = card =>
  card?.kind === 'linked' ? 0 : (tierById(card?.tier)?.rank ?? 0);

/**
 * Card face markup. The face is always authored horizontally; screens that
 * want the portrait presentation add `turned`, which rotates the whole face a
 * quarter turn clockwise. Keeping one orientation in the DOM is what lets the
 * hero flight interpolate the rotation instead of swapping elements.
 */
export function cardMarkup(tierId, { turned = false, hero = false, muted = false, brand = 'DailyWallet' } = {}) {
  const t = tierById(tierId);
  return `
    <div class="card-fit"${hero ? ' data-hero="card"' : ''} data-rot="${turned ? 90 : 0}">
      <div class="card card--${t.id}${turned ? ' card--turned' : ''}${muted ? ' card--muted' : ''}">
        <div class="card__gloss"></div>
        ${contactless()}
        <div class="card__brand">${brand}</div>
        <div class="card__mark">
          <span class="card__visa">VISA</span>
          <span class="card__tier">${t.name}</span>
        </div>
      </div>
    </div>`;
}

/**
 * The face for a stored card — an issued metal one, or a card the user added.
 * Added cards are graphite with light ink and show the brand, since there is
 * no tier to name.
 */
export function cardFace(card, { turned = false, hero = false, muted = false } = {}) {
  const linked = card.kind === 'linked';
  const variant = linked ? 'linked' : card.tier;
  return `
    <div class="card-fit"${hero ? ' data-hero="card"' : ''} data-rot="${turned ? 90 : 0}">
      <div class="card card--${variant}${linked ? ' card--ink-light' : ''}${turned ? ' card--turned' : ''}${muted ? ' card--muted' : ''}">
        <div class="card__gloss"></div>
        ${contactless()}
        <div class="card__brand">${card.label || (linked ? card.brand : 'DailyWallet')}</div>
        <div class="card__mark">
          <span class="card__visa">${linked ? card.brand.toUpperCase() : 'VISA'}</span>
          <span class="card__tier">•••• ${card.last4}</span>
        </div>
      </div>
    </div>`;
}

/** Swap a mounted card face to a different tier without rebuilding it. */
export function setCardTier(fitEl, tierId) {
  const face = fitEl.querySelector('.card');
  if (!face) return;
  face.classList.remove('card--platinum', 'card--silver', 'card--gold');
  face.classList.add(`card--${tierId}`);
  const tier = fitEl.querySelector('.card__tier');
  if (tier) tier.textContent = tierById(tierId).name;
}
