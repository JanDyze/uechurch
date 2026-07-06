import { ref, onMounted, onUnmounted } from "vue";

export function useMediaQuery(query) {
  const matches = ref(
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  let mql;

  const update = () => {
    matches.value = mql?.matches ?? false;
  };

  onMounted(() => {
    mql = window.matchMedia(query);
    update();
    mql.addEventListener("change", update);
  });

  onUnmounted(() => {
    mql?.removeEventListener("change", update);
  });

  return matches;
}
