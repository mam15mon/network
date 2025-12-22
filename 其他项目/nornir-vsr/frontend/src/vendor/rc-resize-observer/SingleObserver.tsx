import * as React from "react";
import { CollectionContext } from "rc-resize-observer/es/Collection";
import { observe, unobserve } from "rc-resize-observer/es/utils/observerUtil";
import { getNodeRef, supportRef, useComposeRef } from "rc-util/es/ref";
import DomWrapper from "./DomWrapper";

type ResizeTarget = Element;

const isElementNode = (node: unknown): node is Element =>
  !!node && typeof node === "object" && (node as Element).nodeType === 1;

type SingleObserverProps = {
  children: React.ReactNode | ((ref: React.RefObject<Element | null>) => React.ReactNode);
  disabled?: boolean;
  data?: unknown;
  onResize?: (
    size: {
      width: number;
      height: number;
      offsetWidth: number;
      offsetHeight: number;
    },
    target: ResizeTarget
  ) => void;
};

const SingleObserver = (props: SingleObserverProps, ref: React.Ref<Element | null>) => {
  const { children, disabled } = props;
  const elementRef = React.useRef<Element | null>(null);
  const wrapperRef = React.useRef<Element | null>(null);
  const onCollectionResize = React.useContext(CollectionContext);

  const isRenderProps = typeof children === "function";
  const mergedChildren = isRenderProps
    ? (children as (ref: React.RefObject<Element | null>) => React.ReactNode)(elementRef)
    : children;

  const sizeRef = React.useRef({
    width: -1,
    height: -1,
    offsetWidth: -1,
    offsetHeight: -1,
  });

  const canRef = !isRenderProps && React.isValidElement(mergedChildren) && supportRef(mergedChildren);
  const originRef = canRef && React.isValidElement(mergedChildren) ? getNodeRef(mergedChildren) : null;
  const mergedRef = useComposeRef(originRef, (node: Element | null) => {
    elementRef.current = node;
  });

  const getDom = React.useCallback((): Element | null => {
    const current = elementRef.current;
    if (isElementNode(current)) {
      return current;
    }
    const nativeElement = (current as any)?.nativeElement as Element | null | undefined;
    if (isElementNode(nativeElement)) {
      return nativeElement;
    }
    return wrapperRef.current;
  }, []);

  React.useImperativeHandle(ref, () => getDom());

  const propsRef = React.useRef(props);
  propsRef.current = props;

  const onInternalResize = React.useCallback(
    (target: Element) => {
      const { onResize, data } = propsRef.current;
      const elementTarget = target as HTMLElement;
      const rect = elementTarget.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      const offsetWidth =
        typeof elementTarget.offsetWidth === "number" ? elementTarget.offsetWidth : rect.width;
      const offsetHeight =
        typeof elementTarget.offsetHeight === "number" ? elementTarget.offsetHeight : rect.height;

      if (
        sizeRef.current.width !== width ||
        sizeRef.current.height !== height ||
        sizeRef.current.offsetWidth !== offsetWidth ||
        sizeRef.current.offsetHeight !== offsetHeight
      ) {
        const size = { width, height, offsetWidth, offsetHeight };
        sizeRef.current = size;

        const mergedOffsetWidth = offsetWidth === Math.round(rect.width) ? rect.width : offsetWidth;
        const mergedOffsetHeight = offsetHeight === Math.round(rect.height) ? rect.height : offsetHeight;
        const sizeInfo = {
          ...size,
          offsetWidth: mergedOffsetWidth,
          offsetHeight: mergedOffsetHeight,
        };

        (onCollectionResize as unknown as ((size: any, target: any, data?: any) => void) | undefined)?.(
          sizeInfo,
          elementTarget,
          data,
        );
        if (onResize) {
          Promise.resolve().then(() => onResize(sizeInfo, elementTarget));
        }
      }
    },
    [onCollectionResize]
  );

  React.useEffect(() => {
    const currentElement = getDom();
    if (currentElement && !disabled) {
      observe(currentElement, onInternalResize);
    }
    return () => {
      if (currentElement) {
        unobserve(currentElement, onInternalResize);
      }
    };
  }, [getDom, disabled, onInternalResize]);

  return (
    <DomWrapper ref={wrapperRef}>
      {canRef && React.isValidElement(mergedChildren)
        ? React.cloneElement(mergedChildren, { ref: mergedRef })
        : mergedChildren}
    </DomWrapper>
  );
};

const RefSingleObserver = React.forwardRef<Element | null, SingleObserverProps>(SingleObserver);

if (import.meta.env.MODE !== "production") {
  RefSingleObserver.displayName = "SingleObserverWithoutFindDOMNode";
}

export default RefSingleObserver;
