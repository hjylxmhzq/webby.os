import React, { cloneElement, useEffect, useRef } from 'react';

export interface VirtualScrollbarProps {
  children: React.ReactElement;
}

export function VirtualScrollbar(props: VirtualScrollbarProps) {
  const elRef = useRef<HTMLElement>(null);
  const children = cloneElement(props.children, { ...props.children.props, ref: elRef }, props.children.props.children);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!(el instanceof HTMLElement)) {
      console.error('VirtualScrollbar: children must be HTMLElement');
      return;
    }
    return attach(el);
  }, []);

  return children;
}

export function attach(el: HTMLElement) {
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
      el.scrollLeft = startScrollLeft + (diff / (el.clientWidth - vbarLength - margin * 2)) * (el.scrollWidth - clientWidth);
    }
    if (isYMoving) {
      const diff = ev.clientY - startY;
      el.scrollTop = startScrollTop + (diff / (el.clientHeight - vbarLength - margin * 2)) * (el.scrollHeight - clientHeight);
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  el.appendChild(hbar);
  el.appendChild(vbar);

  let clientHeight = 0;
  let clientWidth = 0;
  const observer = new ResizeObserver(() => {
    clientHeight = el.clientHeight;
    clientWidth = el.clientWidth;
    init();
  });

  observer.observe(el);

  const updatePos = () => {
    if (!el) return;
    const { scrollTop, scrollLeft, scrollHeight, scrollWidth } = el;
    const hPercent = scrollLeft / (scrollWidth - clientWidth);
    const vPercent = scrollTop / (scrollHeight - clientHeight);
    vbar.style.top = `${margin + vPercent * (clientHeight - margin * 2 - vbarLength) + scrollTop}px`;
    hbar.style.left = `${margin + hPercent * (clientWidth - margin * 2 - hbarLength) + scrollLeft}px`;
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
    const { scrollHeight, scrollWidth, clientHeight, clientWidth } = el;
    vbarLength = ((clientHeight / scrollHeight) * clientHeight) / 1.2;
    hbarLength = ((clientWidth / scrollWidth) * clientWidth) / 1.2;
    vbarLength = Math.max(vbarLength, Math.min(100, clientHeight - 50));
    hbarLength = Math.max(hbarLength, Math.min(100, clientWidth - 50));

    if (scrollHeight > clientHeight) {
      vbar.style.cssText = `
        transition: opacity 0.3s;
        position: absolute;
        right: 5px;
        top: 0;
        width: 5px;
        height: ${vbarLength}px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 5px;
        cursor: pointer;
        opacity: 1;
        user-select: none;
      `;
    } else {
      vbar.style.display = 'none';
    }
    if (scrollWidth > clientWidth) {
      hbar.style.cssText = `
        transition: opacity 0.3s;
        position: absolute;
        bottom: 5px;
        left: 0;
        width: ${hbarLength}px;
        height: 5px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 5px;
        cursor: pointer;
        opacity: 1;
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
    el.removeChild(vbar);
    el.removeChild(hbar);
    el.removeEventListener('scroll', onScroll);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    observer.disconnect();
  };
}
