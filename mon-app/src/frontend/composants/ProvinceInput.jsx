import { useId } from "react";

import {
  CANADIAN_PROVINCES
} from "../constants/canadianLocations.js";

export default function ProvinceInput(props) {
  const listId = useId();

  return (
    <>
      <input {...props} list={listId} />
      <datalist id={listId}>
        {CANADIAN_PROVINCES.map((province) => (
          <option key={province} value={province} />
        ))}
      </datalist>
    </>
  );
}
