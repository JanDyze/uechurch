import { ref, onMounted, onUnmounted } from "vue";
import { LAST_OCCURRENCE } from "../../lib/occurrences";
import {
  subscribeToRecurringSchedules,
  addRecurringSchedule,
  updateRecurringSchedule,
  deleteRecurringSchedule,
} from "../api/recurringSchedulesService";

// Re-exported so the Settings form pulls every schedule constant from one place
export {
  SHOW_BEFORE_OPTIONS,
  DEFAULT_SHOW_BEFORE,
  showBeforeLabel,
} from "../api/recurringSchedulesService";

export const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// "Last" is not a number: it lands on the 5th in a month with five of that
// weekday and the 4th in a month with four, which is how a church that meets
// "on the last Sunday" actually meets. See lib/occurrences.js.
export const OCCURRENCES = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: LAST_OCCURRENCE, label: "Last" },
];

/** Numbers in order, with "Last" always at the end, where it reads right. */
export const sortOccurrences = (values = []) =>
  [...values].sort(
    (a, b) =>
      (a === LAST_OCCURRENCE ? 99 : Number(a)) - (b === LAST_OCCURRENCE ? 99 : Number(b))
  );

export function useRecurringSchedules() {
  const schedules = ref([]);
  const loading = ref(true);
  let unsubscribe = null;

  onMounted(() => {
    unsubscribe = subscribeToRecurringSchedules((data) => {
      schedules.value = data;
      loading.value = false;
    });
  });

  onUnmounted(() => unsubscribe?.());

  return {
    schedules,
    loading,
    addSchedule: addRecurringSchedule,
    updateSchedule: updateRecurringSchedule,
    removeSchedule: deleteRecurringSchedule,
  };
}
