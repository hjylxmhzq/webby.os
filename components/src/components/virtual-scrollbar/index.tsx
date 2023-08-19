import React, { cloneElement, useEffect, useRef } from 'react';

export interface VirtualScrollbarProps<T extends HTMLElement = HTMLElement> {
  children: React.ReactElement;
  forwardedRef?: React.RefCallback<T>;
  scrollbarContainer?: HTMLElement | string;
  scroll?: 'vertical' | 'horizontal' | 'both';
  observeScrollHeightChange?: boolean;
}

export function VirtualScrollbar(props: VirtualScrollbarProps) {
  const elRef = useRef<HTMLElement>();
  const children = cloneElement(
    props.children,
    {
      ...props.children.props,
      ref: (r: HTMLElement) => {
        elRef.current = r;
        if (props.forwardedRef) {
          props.forwardedRef(r);
        }
      },
    },
    props.children.props.children,
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!(el instanceof HTMLElement)) {
      console.error('VirtualScrollbar: children must be HTMLElement');
      return;
    }
    const container = typeof props.scrollbarContainer === 'string' ? document.querySelector(props.scrollbarContainer) : props.scrollbarContainer;
    return attach(el, container as HTMLDivElement, { scrollDir: props.scroll || 'both', observeScrollHeightChange: props.observeScrollHeightChange });
  }, [props.scrollbarContainer, props.children]);

  return children;
}

const hasNativeScrollTo = typeof window !== 'undefined' && 'scrollTo' in window;
const scrollTo = !hasNativeScrollTo
  ? (el: HTMLElement, left?: number, top?: number) => {
      if (top) {
        el.scrollTop = top;
      }
      if (left) {
        el.scrollLeft = left;
      }
    }
  : (el: HTMLElement, left?: number, top?: number) => {
      el.scrollTo({ left, top });
    };

export function attach(
  el: HTMLElement,
  scrollbarContainerEl: HTMLElement = el,
  options: { scrollDir?: 'vertical' | 'horizontal' | 'both'; observeScrollHeightChange?: boolean } = {},
) {
  const { scrollDir = 'both' } = options;
  const style = window.getComputedStyle(el);
  if (style.position === 'static') {
    el.style.position = 'relative';
  }
  const hbar = document.createElement('div');
  const vbar = document.createElement('div');
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let isXMoving = false;
  let isYMoving = false;
  const margin = 5;

  vbar.addEventListener('mousedown', (ev) => {
    startY = ev.clientY;
    isYMoving = true;
    startScrollTop = el.scrollTop;
    setVisible(0);
  });
  hbar.addEventListener('mousedown', (ev) => {
    startX = ev.clientX;
    isXMoving = true;
    startScrollLeft = el.scrollLeft;
    setVisible(0);
  });
  vbar.addEventListener('mouseenter', () => {
    if (!(isXMoving || isYMoving)) {
      setVisible(0);
    }
  });
  hbar.addEventListener('mouseenter', () => {
    if (!(isXMoving || isYMoving)) {
      setVisible(0);
    }
  });
  vbar.addEventListener('mouseleave', () => {
    if (!(isXMoving || isYMoving)) {
      setVisible();
    }
  });
  hbar.addEventListener('mouseleave', () => {
    if (!(isXMoving || isYMoving)) {
      setVisible();
    }
  });

  const onMouseUp = () => {
    isXMoving = false;
    isYMoving = false;
    setVisible();
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (isXMoving) {
      const diff = ev.clientX - startX;
      const diffPercent = diff / (containerClientWidth - vbarLength - margin * 2);
      const scrollLeft = startScrollLeft + diffPercent * (el.scrollWidth - clientWidth);
      scrollTo(el, scrollLeft);
    }
    if (isYMoving) {
      const diff = ev.clientY - startY;
      const diffPercent = diff / (containerClientHeight - vbarLength - margin * 2);
      const scrollTop = startScrollTop + diffPercent * (el.scrollHeight - clientHeight);
      scrollTo(el, undefined, scrollTop);
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  scrollbarContainerEl.appendChild(hbar);
  scrollbarContainerEl.appendChild(vbar);

  let clientHeight = el.clientHeight;
  let clientWidth = el.clientWidth;
  let containerClientHeight = scrollbarContainerEl.clientHeight;
  let containerClientWidth = scrollbarContainerEl.clientWidth;
  const observer = new ResizeObserver(() => {
    clientHeight = el.clientHeight;
    clientWidth = el.clientWidth;
    init();
  });
  const containerObserver = new ResizeObserver(() => {
    containerClientHeight = scrollbarContainerEl.clientHeight;
    containerClientWidth = scrollbarContainerEl.clientWidth;
  });

  observer.observe(el);
  if (options.observeScrollHeightChange) {
    for (const child of el.children) {
      observer.observe(child);
    }
  }
  containerObserver.observe(scrollbarContainerEl);

  const updatePos = () => {
    if (!el) return;
    const { scrollTop, scrollLeft, scrollHeight, scrollWidth } = el;
    const hPercent = scrollLeft / (scrollWidth - clientWidth);
    const vPercent = scrollTop / (scrollHeight - clientHeight);

    const extraTop = scrollbarContainerEl !== el ? 0 : scrollTop;
    const extraLeft = scrollbarContainerEl !== el ? 0 : scrollLeft;
    vbar.style.top = `${margin + vPercent * (containerClientHeight - margin * 2 - vbarLength) + extraTop}px`;
    hbar.style.left = `${margin + hPercent * (containerClientWidth - margin * 2 - hbarLength) + extraLeft}px`;
  };

  let timer: number | undefined = undefined;
  const setVisible = (timeout = 2000) => {
    clearTimeout(timer);
    vbar.style.opacity = '1';
    hbar.style.opacity = '1';
    if (timeout > 0) {
      timer = window.setTimeout(() => {
        vbar.style.opacity = '0';
        hbar.style.opacity = '0';
      }, 2000);
    }
  };

  const onScroll = () => {
    updatePos();
    setVisible();
  };

  el.addEventListener('scroll', onScroll);

  let vbarLength = 0;
  let hbarLength = 0;
  const init = () => {
    const { scrollHeight, scrollWidth, clientHeight, clientWidth } = scrollbarContainerEl;
    const { scrollHeight: elScrollHeight, scrollWidth: elScrollWidth, clientHeight: elClientHeight, clientWidth: elClientWidth } = el;
    vbarLength = ((elClientHeight / elScrollHeight) * clientHeight) / 1.2;
    hbarLength = ((elClientWidth / elScrollWidth) * clientWidth) / 1.2;
    vbarLength = Math.max(vbarLength, Math.min(50, clientHeight - 50));
    hbarLength = Math.max(hbarLength, Math.min(50, clientWidth - 50));

    if (scrollHeight > clientHeight && (scrollDir === 'vertical' || scrollDir === 'both')) {
      vbar.style.cssText = `
        transition: opacity 0.3s;
        position: absolute;
        right: 2px;
        top: 0;
        width: 5px;
        height: ${vbarLength}px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 5px;
        cursor: pointer;
        opacity: 1;
        z-index: 999999;
        user-select: none;
      `;
    } else {
      vbar.style.display = 'none';
    }
    if (scrollWidth > clientWidth && (scrollDir === 'horizontal' || scrollDir === 'both')) {
      hbar.style.cssText = `
        transition: opacity 0.3s;
        position: absolute;
        bottom: 2px;
        left: 0;
        width: ${hbarLength}px;
        height: 5px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 5px;
        cursor: pointer;
        opacity: 1;
        z-index: 999999;
        user-select: none;
      `;
    } else {
      hbar.style.display = 'none';
    }
    updatePos();
    setVisible();
  };

  init();

  return () => {
    scrollbarContainerEl.removeChild(vbar);
    scrollbarContainerEl.removeChild(hbar);
    el.removeEventListener('scroll', onScroll);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    observer.disconnect();
    containerObserver.disconnect();
  };
}
