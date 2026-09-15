import { contactless } from '../icons.js';

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
        ${contactless()}
        <div class="card__brand">${brand}</div>
        <div class="card__mark">
          <span class="card__visa">VISA</span>
          <span class="card__tier">${t.name}</span>
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
