import { ref, onMounted, onUnmounted } from "vue";
import {
  subscribeToRecurringSchedules,
  addRecurringSchedule,
  updateRecurringSchedule,
  deleteRecurringSchedule,
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

export const OCCURRENCES = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
];

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
