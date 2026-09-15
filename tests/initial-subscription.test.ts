import { test } from "node:test";
import assert from "node:assert/strict";

import { initialSubscription, REQUIRE_MANUAL_ACTIVATION, TRIAL_DAYS } from "../src/lib/plans";

/** Une école qui s'inscrit démarre son essai tout de suite, sauf si la
 *  validation manuelle par l'éditeur est rétablie. */

test("une nouvelle école démarre son essai dès l'inscription", { skip: REQUIRE_MANUAL_ACTIVATION }, () => {
  const now = new Date("2026-09-15T10:00:00Z");
  const { subscriptionStatus, nextDueAt } = initialSubscription(now);
  assert.equal(subscriptionStatus, "trial");
  const end = new Date(now);
  end.setDate(end.getDate() + TRIAL_DAYS);
  assert.equal(nextDueAt?.toISOString(), end.toISOString());
});

test("avec la validation manuelle, une nouvelle école attend son activation", { skip: !REQUIRE_MANUAL_ACTIVATION }, () => {
  assert.deepEqual(initialSubscription(), { subscriptionStatus: "pending", nextDueAt: null });
});
