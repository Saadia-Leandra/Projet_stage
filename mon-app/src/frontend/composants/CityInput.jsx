import { useId } from "react";

import { QUEBEC_CITIES } from "../constants/canadianLocations.js";

export default function CityInput(props) {
  const listId = useId();

  return (
    <>
      <input {...props} list={listId} />
      <datalist id={listId}>
        {QUEBEC_CITIES.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </>
  );
}
