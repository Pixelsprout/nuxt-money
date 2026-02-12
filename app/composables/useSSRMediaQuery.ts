import { ref, onMounted, onBeforeUnmount } from "vue";

/**
 * SSR-safe media query composable that prevents hydration mismatches.
 *
 * During SSR, this always returns false to ensure consistent rendering.
 * On the client, it activates the media query after mount to detect actual screen size.
 *
 * @param query - The media query string (e.g., "(min-width: 768px)")
 * @returns A reactive ref that updates when the media query matches/unmatches
 */
export function useSSRMediaQuery(query: string) {
  // Always return false during SSR to ensure consistent rendering
  const matches = ref(false);

  onMounted(() => {
    // Only activate media query on the client after mounting
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia(query);
      matches.value = mediaQuery.matches;

      const handler = (e: MediaQueryListEvent) => {
        matches.value = e.matches;
      };

      mediaQuery.addEventListener("change", handler);

      // Cleanup
      onBeforeUnmount(() => {
        mediaQuery.removeEventListener("change", handler);
      });
    }
  });

  return matches;
}
