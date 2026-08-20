import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStageEndDate,
  calculateStageWeeks,
  recalculateStagePeriod
} from "../../src/frontend/utils/stageDuration.js";

test("calculateStageEndDate ajoute une duree inclusive en semaines", () => {
  assert.equal(
    calculateStageEndDate("2026-01-07", 1),
    "2026-01-13"
  );
  assert.equal(
    calculateStageEndDate("2026-01-07", 8),
    "2026-03-03"
  );
});

test("calculateStageEndDate reste stable autour des changements de mois", () => {
  assert.equal(
    calculateStageEndDate("2026-02-25", 2),
    "2026-03-10"
  );
});

test("calculateStageEndDate ignore les valeurs incompletes ou invalides", () => {
  assert.equal(calculateStageEndDate("", 8), "");
  assert.equal(calculateStageEndDate("2026-01-07", ""), "");
  assert.equal(calculateStageEndDate("2026-02-31", 2), "");
});

test("recalculateStagePeriod met a jour la fin quand la date de debut change", () => {
  assert.deepEqual(
    recalculateStagePeriod(
      {
        startDate: "2026-01-07",
        endDate: "2026-01-20",
        numberOfWeeks: "2"
      },
      "startDate",
      "2026-02-02"
    ),
    {
      startDate: "2026-02-02",
      endDate: "2026-02-15",
      numberOfWeeks: "2"
    }
  );
});

test("recalculateStagePeriod met a jour la fin quand la duree change", () => {
  assert.deepEqual(
    recalculateStagePeriod(
      {
        startDate: "2026-01-07",
        endDate: "2026-01-20",
        numberOfWeeks: "2"
      },
      "numberOfWeeks",
      "3"
    ),
    {
      startDate: "2026-01-07",
      endDate: "2026-01-27",
      numberOfWeeks: "3"
    }
  );
});

test("recalculateStagePeriod recalcule les semaines si la fin est corrigee manuellement", () => {
  assert.deepEqual(
    recalculateStagePeriod(
      {
        startDate: "2026-01-07",
        endDate: "2026-01-20",
        numberOfWeeks: "2"
      },
      "endDate",
      "2026-02-03"
    ),
    {
      startDate: "2026-01-07",
      endDate: "2026-02-03",
      numberOfWeeks: "4"
    }
  );

  assert.equal(
    calculateStageWeeks("2026-01-07", "2026-02-03"),
    "4"
  );
});
