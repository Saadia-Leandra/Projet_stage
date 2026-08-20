import assert from "node:assert/strict";
import test from "node:test";

import {
  navigationTargetFromActionUrl,
  requestByNavigationId,
  stableRequestSelection
} from "../../src/frontend/utils/navigationContext.js";

test("navigationTargetFromActionUrl cible directement une demande etudiante", () => {
  assert.deepEqual(
    navigationTargetFromActionUrl("/demandes-stage/42"),
    {
      view: "requests",
      context: { requestId: 42 }
    }
  );
});

test("navigationTargetFromActionUrl cible directement une demande superviseur", () => {
  assert.deepEqual(
    navigationTargetFromActionUrl("/supervisor/stages/requests/17"),
    {
      view: "stageRequests",
      context: { requestId: 17 }
    }
  );
});

test("navigationTargetFromActionUrl conserve les destinations de contrats", () => {
  assert.deepEqual(
    navigationTargetFromActionUrl("/contracts/8"),
    {
      view: "contracts",
      context: { contractId: 8 }
    }
  );

  assert.deepEqual(
    navigationTargetFromActionUrl("/stage-management/contracts/9"),
    {
      view: "stageContracts",
      context: { contractId: 9 }
    }
  );
});

test("requestByNavigationId retrouve uniquement une demande valide", () => {
  const requests = [
    { id: 11, studentFullName: "TEST_DEMO_A" },
    { id: 12, studentFullName: "TEST_DEMO_B" }
  ];

  assert.equal(
    requestByNavigationId(requests, "12"),
    requests[1]
  );
  assert.equal(requestByNavigationId(requests, "abc"), null);
  assert.equal(requestByNavigationId(requests, "99"), null);
});

test("stableRequestSelection evite de vider le panneau pendant le chargement", () => {
  const currentRequest = {
    id: 5,
    studentFullName: "Details complets"
  };
  const samePendingRequest = {
    id: 5,
    studentFullName: "Resume"
  };
  const nextPendingRequest = {
    id: 6,
    studentFullName: "Nouvelle demande"
  };

  assert.equal(
    stableRequestSelection(currentRequest, samePendingRequest),
    currentRequest
  );
  assert.equal(
    stableRequestSelection(currentRequest, nextPendingRequest),
    nextPendingRequest
  );
});
