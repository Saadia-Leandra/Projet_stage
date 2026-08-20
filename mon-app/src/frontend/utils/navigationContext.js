export function navigationTargetFromActionUrl(actionUrl = "") {
  const url = String(actionUrl || "");

  const supervisorRequestId = readPathId(
    url,
    /\/supervisor\/stages\/requests\/(\d+)/
  );
  if (supervisorRequestId) {
    return {
      view: "stageRequests",
      context: { requestId: supervisorRequestId }
    };
  }

  const studentRequestId = readPathId(
    url,
    /\/demandes-stage\/(\d+)/
  );
  if (studentRequestId) {
    return {
      view: "requests",
      context: { requestId: studentRequestId }
    };
  }

  const stageContractId = readPathId(
    url,
    /\/stage-management\/contracts\/(\d+)/
  );
  if (stageContractId) {
    return {
      view: "stageContracts",
      context: { contractId: stageContractId }
    };
  }

  const studentContractId = readPathId(
    url,
    /\/contracts\/(\d+)/
  );
  if (studentContractId) {
    return {
      view: "contracts",
      context: { contractId: studentContractId }
    };
  }

  if (url.includes("/messages")) {
    return { view: "messages", context: {} };
  }

  if (url.includes("/documents")) {
    return { view: "documents", context: {} };
  }

  return null;
}

export function requestByNavigationId(requests, requestId) {
  const targetId = Number(requestId);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    return null;
  }

  return (
    (requests || []).find(
      (request) => Number(request?.id) === targetId
    ) || null
  );
}

export function stableRequestSelection(
  currentRequest,
  pendingRequest
) {
  if (!pendingRequest) {
    return currentRequest || null;
  }

  if (
    currentRequest &&
    Number(currentRequest.id) === Number(pendingRequest.id)
  ) {
    return currentRequest;
  }

  return pendingRequest;
}

function readPathId(url, pattern) {
  const match = pattern.exec(url);
  const id = Number(match?.[1]);

  return Number.isInteger(id) && id > 0 ? id : null;
}
