import React, { useState, Children, cloneElement } from "react";

// Tabs Root
export function Tabs({ defaultValue, children, className }) {
  const [active, setActive] = useState(defaultValue);

  // Pass active value and setter to children
  return (
    <div className={className}>
      {Children.map(children, (child) =>
        cloneElement(child, { active, setActive })
      )}
    </div>
  );
}

// Tabs List
export function TabsList({ children, className, active, setActive }) {
  return (
    <div className={className}>
      {Children.map(children, (child) =>
        cloneElement(child, { active, setActive })
      )}
    </div>
  );
}

// Tabs Trigger
export function TabsTrigger({
  value,
  children,
  className,
  active,
  setActive,
}) {
  const isActive = active === value;
  return (
    <button
      className={`${className} ${isActive ? "bg-blue-900 text-yellow-400" : ""}`}
      onClick={() => setActive(value)}
      type="button"
    >
      {children}
    </button>
  );
}

// Tabs Content
export function TabsContent({ value, children, active, className }) {
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}
