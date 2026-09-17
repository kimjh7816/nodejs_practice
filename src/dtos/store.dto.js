import { BadRequestError } from "../errors.js";
import { parseId, requireString } from "../utils/validation.js";

const TIME_PATTERN = "([01]?\\d|2[0-3]):[0-5]\\d";
const OPERATING_HOURS_REGEX = new RegExp(
  `^\\s*(${TIME_PATTERN})\\s*[-~]\\s*(${TIME_PATTERN})\\s*$`
);

// MySQL TIME 컬럼을 Prisma는 Date로 주고받는다. (1970-01-01을 기준으로 한 UTC 시각)
// 그래서 "HH:MM" 문자열을 그 기준에 맞춘 Date로 바꿔서 넘겨야 한다.
const toTime = (hourMinute) =>
  new Date(`1970-01-01T${hourMinute.padStart(5, "0")}:00Z`);

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
  return { openTime: toTime(match[1]), closeTime: toTime(match[3]) };
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

// TIME 컬럼은 1970-01-01 기준 Date로 조회되므로 UTC 시/분만 뽑아서 "HH:MM"으로 만든다.
const toHourMinute = (time) =>
  time
    ? `${String(time.getUTCHours()).padStart(2, "0")}:${String(
        time.getUTCMinutes()
      ).padStart(2, "0")}`
    : null;

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
