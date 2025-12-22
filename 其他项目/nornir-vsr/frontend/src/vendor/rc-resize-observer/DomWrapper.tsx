import * as React from "react";
import { composeRef, supportRef } from "rc-util/es/ref";

type DomWrapperProps = React.PropsWithChildren<Record<string, unknown>>;

/**
 * Drop-in replacement for rc-resize-observer's DomWrapper that avoids ReactDOM.findDOMNode.
 * It tries to reuse the child's ref when possible and falls back to a span with display: contents
 * so layout stays untouched while still exposing a stable DOM element.
 */
const DomWrapper = React.forwardRef<Element | null, DomWrapperProps>(({ children }, ref) => {
  const assignRef = React.useCallback(
    (node: Element | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<Element | null>).current = node;
      }
    },
    [ref]
  );

  if (React.isValidElement(children) && supportRef(children)) {
    const childRef = composeRef((children as any).ref, assignRef);
    return React.cloneElement(children as React.ReactElement, { ref: childRef } as any);
  }

  return (
    <span style={{ display: "contents" }} ref={assignRef as unknown as React.Ref<HTMLSpanElement>}>
      {children as React.ReactNode}
    </span>
  );
});

DomWrapper.displayName = "DomWrapperWithoutFindDOMNode";

export default DomWrapper;
