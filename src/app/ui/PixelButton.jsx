import React from "react";
import "./PixelUI.css";

const VARIANT_CLASSES = {
  menu: "pixel-button-menu",
  marketplace: "pixel-btn",
  default: "pixel-btn",
};

const SIZE_CLASSES = {
  small: "px-4 py-2 text-xs",
  medium: "px-6 py-3 text-base",
  large: "px-8 py-4 text-lg",
  "half-custom": "button-half-custom",
};

const PixelButton = ({
  text,
  variant = "default",
  size = "medium",
  onClick,
  children,
  className = "",
  style,
  isActive,
  ...props
}) => {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.default;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.medium;

  return (
    <button
      onClick={onClick}
      className={`
        ${variantClass} ${sizeClass} pixelated-font font-bold tracking-wider select-none rounded-none uppercase
        ${className}
      `}
      style={style}
      {...props}
    >
      {text || children}
    </button>
  );
};

export default PixelButton;
