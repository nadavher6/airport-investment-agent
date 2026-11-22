import { useEffect, useRef } from "react";

const THRESHOLD_PX = 80;

/**
 * Follows streamed content as it grows, but lets go as soon as the user
 * scrolls up to read, and resumes once they scroll back to the bottom.
 */
export function useStickToBottom<TScroll extends HTMLElement, TContent extends HTMLElement>(enabled: boolean) {
  const scrollRef = useRef<TScroll>(null);
  const contentRef = useRef<TContent>(null);
  const stuck = useRef(true);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const onScroll = () => {
      stuck.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < THRESHOLD_PX;
    };
    const observer = new ResizeObserver(() => {
      if (enabledRef.current && stuck.current) scroller.scrollTop = scroller.scrollHeight;
    });

    scroller.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(content);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  /** Call when the user sends, so their own message is always brought into view. */
  const stick = () => {
    stuck.current = true;
  };

  return { scrollRef, contentRef, stick };
}
