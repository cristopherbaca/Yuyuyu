import type { Register } from './register'
import type { Services } from '../services/container'
export function registerReviews(register: Register, s: Services) {
  register('reviews:submit', (input) => s.reviews.submit(input))
  register('reviews:reveal', ({ conceptId, variantId }) => s.session.reveal(conceptId, variantId))
  register('reviews:override', ({ reviewId, verdict }) => s.reviews.override(reviewId, verdict))
}
