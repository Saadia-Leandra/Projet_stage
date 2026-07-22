export async function readMultipartFormData(
  req,
  { maxBytes }
) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(
    /boundary=(?:"([^"]+)"|([^;]+))/i
  );

  if (!boundaryMatch) {
    throw createError("Requete multipart invalide.", 400);
  }

  const boundary = Buffer.from(
    `--${boundaryMatch[1] || boundaryMatch[2]}`
  );
  const body = await readRequestBuffer(req, maxBytes);
  const parts = splitBuffer(body, boundary);
  const fields = {};
  const files = {};

  for (const rawPart of parts) {
    const part = trimMultipartPart(rawPart);

    if (
      !part.length ||
      part.equals(Buffer.from("--")) ||
      part.slice(0, 2).toString() === "--"
    ) {
      continue;
    }

    const headerEnd = part.indexOf(
      Buffer.from("\r\n\r\n")
    );

    if (headerEnd < 0) {
      continue;
    }

    const headerText = part
      .slice(0, headerEnd)
      .toString("latin1");
    const content = part.slice(headerEnd + 4);
    const disposition =
      headerText.match(
        /content-disposition:\s*([^\r\n]+)/i
      )?.[1] || "";
    const name =
      disposition.match(/name="([^"]+)"/i)?.[1];
    const fileName =
      disposition.match(/filename="([^"]*)"/i)?.[1];
    const contentTypeHeader =
      headerText.match(
        /content-type:\s*([^\r\n]+)/i
      )?.[1] || "";

    if (!name) {
      continue;
    }

    if (fileName !== undefined) {
      files[name] = {
        fileName,
        contentType: contentTypeHeader.trim(),
        buffer: content
      };
    } else {
      fields[name] = content.toString("utf8").trim();
    }
  }

  return { fields, files };
}

async function readRequestBuffer(req, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > maxBytes) {
      throw createError(
        "Le fichier depasse la taille maximale.",
        413
      );
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index >= 0) {
    if (index > start) {
      parts.push(buffer.slice(start, index));
    }

    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  if (start < buffer.length) {
    parts.push(buffer.slice(start));
  }

  return parts;
}

function trimMultipartPart(part) {
  let start = 0;
  let end = part.length;

  if (
    part[start] === 13 &&
    part[start + 1] === 10
  ) {
    start += 2;
  }

  if (
    part[end - 2] === 13 &&
    part[end - 1] === 10
  ) {
    end -= 2;
  }

  return part.slice(start, end);
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
