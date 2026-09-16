import { BadRequestError } from "../errors.js";
import { parseId, requireString } from "../utils/validation.js";

const TIME_PATTERN = "([01]?\\d|2[0-3]):[0-5]\\d";
const OPERATING_HOURS_REGEX = new RegExp(
  `^\\s*(${TIME_PATTERN})\\s*[-~]\\s*(${TIME_PATTERN})\\s*$`
);

// "12:00 - 22:00" 형태의 문자열을 open_time / close_time 으로 나눈다.
const parseOperatingHours = (value) => {
  if (value === undefined || value === null || value === "") {
    return { openTime: null, closeTime: null };
  }

  const match = String(value).match(OPERATING_HOURS_REGEX);
  if (!match) {
    throw new BadRequestError(
      "operating_hours는 'HH:MM - HH:MM' 형식이어야 합니다."
    );
  }
  return { openTime: match[1], closeTime: match[3] };
};

export const bodyToStore = (body, regionId) => {
  const { openTime, closeTime } = parseOperatingHours(body.operating_hours);

  return {
    regionId: parseId(regionId, "regionId"),
    categoryId: parseId(body.store_category_id, "store_category_id"),
    name: requireString(body.store_name, "store_name", 60),
    address: requireString(body.store_address, "store_address", 200),
    openTime,
    closeTime,
  };
};

// TIME 컬럼은 "12:00:00" 문자열로 조회되므로 "HH:MM"까지만 사용한다.
const toHourMinute = (time) => (time ? time.slice(0, 5) : null);

export const responseFromStore = (store) => ({
  store_id: store.id,
  region_id: store.region_id,
  store_category_id: store.category_id,
  store_name: store.name,
  store_address: store.address1,
  operating_hours:
    store.open_time && store.close_time
      ? `${toHourMinute(store.open_time)} - ${toHourMinute(store.close_time)}`
      : null,
  created_at: store.created_at,
});
