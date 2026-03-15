import * as React from "react";

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(value);
      else {
        try {
          (ref as React.MutableRefObject<T | null>).current = value;
        } catch {}
      }
    }
  };
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(function Slot(
  { children, ...props },
  forwardedRef
) {
  if (!React.isValidElement(children)) return null;

  const child = children as React.ReactElement<any>;
  const childProps = child.props ?? {};
  const mergedClassName = [childProps.className, props.className].filter(Boolean).join(' ');
  const mergedStyle = { ...(childProps.style ?? {}), ...(props.style ?? {}) };

  return React.cloneElement(child, {
    ...props,
    ...childProps,
    className: mergedClassName || undefined,
    style: mergedStyle,
    ref: mergeRefs((child as any).ref, forwardedRef as any),
  });
});
