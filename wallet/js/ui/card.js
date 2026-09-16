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
export const TIERS = [
  { id: 'platinum', name: 'Platinum', price: 199, subtitle: 'Platinum metal' },
  { id: 'silver',   name: 'Silver',   price:  99, subtitle: 'Silver metal'   },
  { id: 'gold',     name: 'Gold',     price: 349, subtitle: 'Gold metal'     },
];

export const tierById = id => TIERS.find(t => t.id === id) || TIERS[0];

/**
 * Card face markup. The face is always authored horizontally; screens that
 * want the portrait presentation add `turned`, which rotates the whole face a
 * quarter turn clockwise. Keeping one orientation in the DOM is what lets the
 * hero flight interpolate the rotation instead of swapping elements.
 */
export function cardMarkup(tierId, { turned = false, hero = false, brand = 'DailyWallet' } = {}) {
  const t = tierById(tierId);
  return `
    <div class="card-fit"${hero ? ' data-hero="card"' : ''} data-rot="${turned ? 90 : 0}">
      <div class="card card--${t.id}${turned ? ' card--turned' : ''}">
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
export function cardFace(card, { turned = false, hero = false } = {}) {
  const linked = card.kind === 'linked';
  const variant = linked ? 'linked' : card.tier;
  return `
    <div class="card-fit"${hero ? ' data-hero="card"' : ''} data-rot="${turned ? 90 : 0}">
      <div class="card card--${variant}${linked ? ' card--ink-light' : ''}${turned ? ' card--turned' : ''}">
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
